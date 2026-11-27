-- Etapa 5: produção, perdas e descartes de saladas prontas (com histórico). Não permite estoque negativo.
create or replace function register_stock_movement(p_variant uuid, p_kind text, p_qty int, p_note text) returns void language plpgsql as $$
declare v record;
begin
  if not is_owner() then raise exception 'Sem permissão'; end if;
  if p_kind not in ('producao', 'perda', 'descarte') then raise exception 'Tipo de movimentação inválido'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Informe uma quantidade maior que zero'; end if;
  select pv.stock_qty, pv.size_ml, p.name into v from product_variants pv join products p on p.id = pv.product_id where pv.id = p_variant for update of pv;
  if not found then raise exception 'Produto não encontrado'; end if;
  if p_kind <> 'producao' and v.stock_qty < p_qty then raise exception 'Estoque insuficiente: % % ml (restam %)', v.name, v.size_ml, v.stock_qty; end if;
  update product_variants set stock_qty = stock_qty + case when p_kind = 'producao' then p_qty else -p_qty end where id = p_variant;
  insert into stock_movements(variant_id, kind, quantity, note) values (p_variant, p_kind, p_qty, nullif(trim(p_note), ''));
end $$;
grant execute on function register_stock_movement(uuid, text, int, text) to authenticated;
notify pgrst, 'reload schema';
