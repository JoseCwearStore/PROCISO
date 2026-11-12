-- D6 / AUD01-M2: el servidor exige que la contraseña temporal CAMBIE de verdad.
-- Antes, marcar_contrasena_cambiada() desmarcaba la bandera sin comprobar nada.
--
-- Cómo se detecta el cambio: al marcar un perfil como temporal se guarda la huella
-- (hash) de su contraseña en ese momento; la función solo desmarca si el hash de
-- auth.users ya es otro. NO se usa auth.users.updated_at: medido el 2026-11-11, un
-- simple inicio de sesión lo mueve, así que quien conozca la contraseña del repo
-- pasaría la verificación sin cambiarla.

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- A: temporal, nunca cambia su contraseña · B: temporal, la cambia · C: no es temporal
-- D: invitado (sin contraseña todavía: hash vacío)
insert into auth.users (id, email, aud, role, encrypted_password) values
  ('fcfcfcfc-0000-0000-0000-00000000000a', 'tmp-a@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashOriginalDeA'),
  ('fcfcfcfc-0000-0000-0000-00000000000b', 'tmp-b@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashOriginalDeB'),
  ('fcfcfcfc-0000-0000-0000-00000000000c', 'tmp-c@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashOriginalDeC'),
  ('fcfcfcfc-0000-0000-0000-00000000000d', 'tmp-d@cowin.test', 'authenticated', 'authenticated', ''),
  ('fcfcfcfc-0000-0000-0000-00000000000e', 'tmp-e@cowin.test', 'authenticated', 'authenticated', null),
  ('fcfcfcfc-0000-0000-0000-000000000011', 'tmp-f@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashOriginalDeF'),
  ('fcfcfcfc-0000-0000-0000-000000000012', 'tmp-g@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashOriginalDeG');

insert into public.consultorias (id, nombre) values ('fcfcfcfc-0000-0000-0000-0000000000f1', 'Consultoría D6');

insert into public.perfiles (id, nombre, email, rol, consultoria_id, password_temporal) values
  ('fcfcfcfc-0000-0000-0000-00000000000a', 'Temp A', 'tmp-a@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true),
  ('fcfcfcfc-0000-0000-0000-00000000000b', 'Temp B', 'tmp-b@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true),
  ('fcfcfcfc-0000-0000-0000-00000000000c', 'Fija C', 'tmp-c@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', false),
  ('fcfcfcfc-0000-0000-0000-00000000000d', 'Invitado D', 'tmp-d@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true),
  ('fcfcfcfc-0000-0000-0000-00000000000e', 'Invitado E', 'tmp-e@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true),
  ('fcfcfcfc-0000-0000-0000-000000000011', 'Temp F', 'tmp-f@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true),
  ('fcfcfcfc-0000-0000-0000-000000000012', 'Temp G', 'tmp-g@cowin.test', 'consultor', 'fcfcfcfc-0000-0000-0000-0000000000f1', true);

-- ─── Anónimo y tabla interna ───
set local role anon;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '42501', null,
  'Un anónimo no puede ejecutar la función');
reset role;

select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from private.contrasena_temporal $$, '42501', null,
  'Un usuario no puede leer las huellas guardadas (schema private)');

-- ─── A: no cambió la contraseña ───
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023',
  'Cambia tu contraseña temporal para continuar.',
  'A: sin haber cambiado la contraseña, la función se niega');
reset role;
select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000a'), true,
  'A: la bandera sigue en true');

-- Un inicio de sesión mueve updated_at y last_sign_in_at, pero NO el hash.
update auth.users set updated_at = now() + interval '1 hour', last_sign_in_at = now() + interval '1 hour'
 where id = 'fcfcfcfc-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'A: iniciar sesión (updated_at nuevo) no cuenta como cambiar la contraseña');
reset role;

-- B cambia SU contraseña; eso no libera a A.
update auth.users set encrypted_password = '$2a$10$hashNuevoDeB' where id = 'fcfcfcfc-0000-0000-0000-00000000000b';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'A: que B haya cambiado la suya no desbloquea a A');
reset role;

-- ─── B: sí cambió ───
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'B: con la contraseña cambiada, la función desmarca la bandera');
reset role;
select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000b'), false,
  'B: la bandera quedó en false');
select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000a'), true,
  'A: la bandera de A no se tocó');

set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'B: volver a llamarla es inofensivo (idempotente)');
reset role;

-- ─── C: nunca fue temporal ───
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'C: sin bandera de temporal, la función no falla');
reset role;
select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000c'), false,
  'C: la bandera sigue en false');

-- ─── Volver a marcar como temporal (reinicio de contraseña por un admin) exige un cambio NUEVO ───
update public.perfiles set password_temporal = true where id = 'fcfcfcfc-0000-0000-0000-00000000000b';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'B: al volver a marcarla como temporal, el cambio anterior ya no vale');
reset role;
update auth.users set encrypted_password = '$2a$10$otroHashNuevoDeB' where id = 'fcfcfcfc-0000-0000-0000-00000000000b';
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'B: tras un cambio nuevo, vuelve a poder desmarcar');
reset role;
select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000b'), false,
  'B: bandera en false otra vez');

-- ─── D: invitado (hash vacío) ───
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'D: un invitado que aún no definió contraseña no puede desmarcar');
reset role;
update auth.users set encrypted_password = '$2a$10$hashQueDefinioD' where id = 'fcfcfcfc-0000-0000-0000-00000000000d';
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'D: una vez que define su contraseña, puede desmarcar');
reset role;

-- ─── E: invitado cuyo hash es NULL (en vez de vacío) ───
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'E: con hash NULL y sin contraseña definida, tampoco puede desmarcar');
reset role;
update auth.users set encrypted_password = '$2a$10$hashQueDefinioE' where id = 'fcfcfcfc-0000-0000-0000-00000000000e';
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'E: una vez que define su contraseña, puede desmarcar');
reset role;

-- ─── F: un admin quita la bandera a mano (sin cambio de contraseña) ───
-- La huella guardada debe desaparecer con la bandera: si no, F, que ya no es temporal,
-- recibiría el error "Cambia tu contraseña" al llamar a la función.
update public.perfiles set password_temporal = false where id = 'fcfcfcfc-0000-0000-0000-000000000011';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000011","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'F: sin bandera de temporal no hay huella pendiente, aunque su contraseña no cambió');
reset role;

-- ─── G: reinicio de contraseña mientras todavía era temporal ───
-- Un admin pone una contraseña nueva y vuelve a marcar el perfil (ya estaba en true).
-- La huella tiene que refrescarse: la contraseña vigente es la NUEVA, y G no la cambió.
update auth.users set encrypted_password = '$2a$10$hashReinicioDeG' where id = 'fcfcfcfc-0000-0000-0000-000000000012';
update public.perfiles set password_temporal = true where id = 'fcfcfcfc-0000-0000-0000-000000000012';
select set_config('request.jwt.claims', '{"sub":"fcfcfcfc-0000-0000-0000-000000000012","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.marcar_contrasena_cambiada() $$, '22023', null,
  'G: tras un reinicio con la bandera ya en true, la contraseña nueva también hay que cambiarla');
reset role;
update auth.users set encrypted_password = '$2a$10$hashPropioDeG' where id = 'fcfcfcfc-0000-0000-0000-000000000012';
set local role authenticated;
select lives_ok($$ select public.marcar_contrasena_cambiada() $$,
  'G: cuando cambia la contraseña reiniciada, puede desmarcar');
reset role;

select is((select password_temporal from public.perfiles where id = 'fcfcfcfc-0000-0000-0000-00000000000a'), true,
  'A: al final sigue pendiente, sin que nadie más la haya tocado');

select * from finish();
rollback;
