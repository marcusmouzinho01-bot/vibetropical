-- Etapa 2: venda e cancelamento em uma única operação (transação). Preço e estoque são conferidos no banco.
create or replace function register_sale(p_origin text, p_payment text, p_items jsonb) returns uuid language plpgsql as $$
declare s uuid; it jsonb; v record; sub numeric(12,2) := 0; q int;
begin
  if not is_owner() then raise exception 'Sem permissão'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Adicione ao menos um item'; end if;
  insert into sales(origin, payment_method, subtotal, total) values (p_origin, p_payment, 0, 0) returning id into s;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'quantity')::int;
    if q is null or q <= 0 then raise exception 'Quantidade inválida'; end if;
    select pv.id, pv.price, pv.size_ml, pv.stock_qty, pv.active, p.name into v
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid for update of pv;
    if not found or not v.active then raise exception 'Item indisponível'; end if;
    if v.stock_qty < q then raise exception 'Estoque insuficiente: % % ml (restam %)', v.name, v.size_ml, v.stock_qty; end if;
    insert into sale_items(sale_id, variant_id, product_name, size_ml, unit_price, quantity) values (s, v.id, v.name, v.size_ml, v.price, q);
    update product_variants set stock_qty = stock_qty - q where id = v.id;
    insert into stock_movements(variant_id, kind, quantity, sale_id) values (v.id, 'venda', q, s);
    sub := sub + v.price * q;
  end loop;
  update sales set subtotal = sub, total = sub where id = s;
  return s;
end $$;

create or replace function cancel_sale(p_sale uuid) returns void language plpgsql as $$
declare i record;
begin
  if not is_owner() then raise exception 'Sem permissão'; end if;
  perform 1 from sales where id = p_sale and status = 'confirmada' for update;
  if not found then raise exception 'Esta venda não pode ser cancelada'; end if;
  for i in select variant_id, quantity from sale_items where sale_id = p_sale loop
    if i.variant_id is not null then
      update product_variants set stock_qty = stock_qty + i.quantity where id = i.variant_id;
      insert into stock_movements(variant_id, kind, quantity, sale_id) values (i.variant_id, 'estorno', i.quantity, p_sale);
    end if;
  end loop;
  update sales set status = 'cancelada' where id = p_sale;
end $$;
grant execute on function register_sale(text, text, jsonb) to authenticated;
grant execute on function cancel_sale(uuid) to authenticated;
