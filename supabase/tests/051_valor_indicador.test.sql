-- O36 · El "Valor observado" de un indicador es un número (o queda vacío = sin datos). La columna era texto libre y la
-- pantalla guardaba cualquier cosa ("abc %"), que luego se mostraba como si fuera una medición. Ahora un CHECK de la tabla
-- lo exige (la pantalla también avisa antes de enviar).

begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, aud, role) values ('51515151-0000-0000-0000-000000000001', 'a@vi.test', 'authenticated', 'authenticated');
insert into public.consultorias (id, nombre) values ('51515151-0000-0000-0001-000000000001', 'Consultoría VI');
insert into public.perfiles (id, nombre, email, rol, consultoria_id, empresa_id) values
  ('51515151-0000-0000-0000-000000000001', 'A', 'a@vi.test', 'admin_consultoria', '51515151-0000-0000-0001-000000000001', null);

create function pg_temp.indicador(p_nombre text, p_valor text) returns void language sql as $$
  insert into public.indicadores (consultoria_id, ambito, nombre, formula, unidad, frecuencia, responsable_id, meta, periodo, valor)
  values ('51515151-0000-0000-0001-000000000001', 'PROCISO', p_nombre, 'a/b', '%', 'Mensual',
          '51515151-0000-0000-0000-000000000001', '90', 'Noviembre', p_valor)
$$;

select lives_ok($$ select pg_temp.indicador('Vacío', '') $$, 'Un valor vacío (sin datos) vale');
select lives_ok($$ select pg_temp.indicador('Entero', '88') $$, 'Un entero vale');
select lives_ok($$ select pg_temp.indicador('Decimal punto', '12.5') $$, 'Un decimal con punto vale');
select lives_ok($$ select pg_temp.indicador('Decimal coma', '12,5') $$, 'Un decimal con coma vale');
select lives_ok($$ select pg_temp.indicador('Negativo', '-3') $$, 'Un negativo vale');
select throws_ok($$ select pg_temp.indicador('Texto', 'abc') $$, '23514', null, 'Un texto no se guarda como valor observado');
select throws_ok($$ select pg_temp.indicador('Con signo', '88%') $$, '23514', null, 'Tampoco "88%" (la unidad va en su propio campo)');
select throws_ok($$ select pg_temp.indicador('Dos puntos', '1.2.3') $$, '23514', null, 'Ni un número con dos separadores');
select throws_ok($$ select pg_temp.indicador('Punto final', '5.') $$, '23514', null, 'Un separador decimal sin decimales no es un número');
select throws_ok($$ select pg_temp.indicador('Punto inicial', '.5') $$, '23514', null, 'Ni un decimal sin parte entera');
select throws_ok($$ update public.indicadores set valor = 'N/A' where nombre = 'Entero' $$, '23514', null,
  'Editar un indicador existente tampoco admite un texto');

select * from finish();
rollback;
