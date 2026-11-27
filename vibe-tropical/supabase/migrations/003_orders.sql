-- Etapa 3: pedidos do WhatsApp. A venda (receita e baixa de estoque) é registrada quando o pedido vira "Entregue".
create or replace function register_order(p_name text, p_phone text, p_service text, p_address text, p_fee numeric, p_payment text, p_notes text, p_items jsonb) returns uuid language plpgsql as $$
declare o uuid; cid uuid; it jsonb; v record; q int; ph text := nullif(trim(p_phone), '');
begin
  if not is_owner() then raise exception 'Sem permissão'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Informe o nome do cliente'; end if;
  if p_service not in ('retirada', 'entrega') then raise exception 'Escolha retirada ou entrega'; end if;
  if p_service = 'entrega' and coalesce(trim(p_address), '') = '' then raise exception 'Informe o endereço da entrega'; end if;
  if p_payment not in ('dinheiro', 'pix', 'credito', 'debito') then raise exception 'Escolha a forma de pagamento'; end if;
  if coalesce(p_fee, 0) < 0 then raise exception 'Taxa de entrega inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Adicione ao menos um item'; end if;
  if ph is not null then
    select id into cid from customers where phone = ph limit 1;
    if cid is null then insert into customers(name, phone, address) values (trim(p_name), ph, nullif(trim(p_address), '')) returning id into cid; end if;
  end if;
  insert into orders(customer_id, customer_name, phone, service_type, address, delivery_fee, payment_method, notes)
    values (cid, trim(p_name), ph, p_service, case when p_service = 'entrega' then trim(p_address) end, case when p_service = 'entrega' then coalesce(p_fee, 0) else 0 end, p_payment, nullif(trim(p_notes), ''))
    returning id into o;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'quantity')::int;
    if q is null or q <= 0 then raise exception 'Quantidade inválida'; end if;
    select pv.id, pv.price, pv.size_ml, pv.active, p.name into v from product_variants pv join products p on p.id = pv.product_id where pv.id = (it->>'variant_id')::uuid;
    if not found or not v.active then raise exception 'Item indisponível'; end if;
    insert into order_items(order_id, variant_id, product_name, size_ml, unit_price, quantity) values (o, v.id, v.name, v.size_ml, v.price, q);
  end loop;
  return o;
end $$;

create or replace function set_order_status(p_order uuid, p_status text) returns void language plpgsql as $$
declare o record; v record; i record; s uuid; sub numeric(12,2) := 0;
  flow text[] := array['aguardando', 'confirmado', 'preparacao', 'saiu', 'entregue'];
begin
  if not is_owner() then raise exception 'Sem permissão'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if o.status in ('entregue', 'cancelado') then raise exception 'Este pedido já foi encerrado'; end if;
  if p_status = 'cancelado' then update orders set status = 'cancelado' where id = p_order; return; end if;
  if array_position(flow, p_status) is null or array_position(flow, p_status) <= array_position(flow, o.status) then raise exception 'Status inválido'; end if;
  if p_status = 'entregue' then
    insert into sales(origin, payment_method, subtotal, delivery_fee, total, order_id, customer_id) values ('whatsapp', o.payment_method, 0, o.delivery_fee, 0, p_order, o.customer_id) returning id into s;
    for i in select * from order_items where order_id = p_order loop
      select stock_qty into v from product_variants where id = i.variant_id for update;
      if v.stock_qty is null or v.stock_qty < i.quantity then raise exception 'Estoque insuficiente: % % ml (restam %)', i.product_name, i.size_ml, coalesce(v.stock_qty, 0); end if;
      insert into sale_items(sale_id, variant_id, product_name, size_ml, unit_price, quantity) values (s, i.variant_id, i.product_name, i.size_ml, i.unit_price, i.quantity);
      update product_variants set stock_qty = stock_qty - i.quantity where id = i.variant_id;
      insert into stock_movements(variant_id, kind, quantity, sale_id) values (i.variant_id, 'venda', i.quantity, s);
      sub := sub + i.unit_price * i.quantity;
    end loop;
    update sales set subtotal = sub, total = sub + o.delivery_fee where id = s;
  end if;
  update orders set status = p_status where id = p_order;
end $$;
grant execute on function register_order(text, text, text, text, numeric, text, text, jsonb) to authenticated;
grant execute on function set_order_status(uuid, text) to authenticated;
notify pgrst, 'reload schema';
