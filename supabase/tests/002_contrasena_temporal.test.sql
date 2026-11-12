-- Después de cambiar la contraseña temporal, el usuario tiene que poder
-- desmarcar SU bandera password_temporal, y nada más.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, aud, role, encrypted_password) values
  ('fbfbfbfb-0000-0000-0000-000000000001', 'temp1@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashInicialUno'),
  ('fbfbfbfb-0000-0000-0000-000000000002', 'temp2@cowin.test', 'authenticated', 'authenticated', '$2a$06$hashInicialDos');

insert into public.consultorias (id, nombre) values ('f5f5f5f5-0000-0000-0000-000000000001', 'Consultoría Temp');

insert into public.perfiles (id, nombre, email, rol, consultoria_id, password_temporal) values
  ('fbfbfbfb-0000-0000-0000-000000000001', 'Temp Uno', 'temp1@cowin.test', 'consultor', 'f5f5f5f5-0000-0000-0000-000000000001', true),
  ('fbfbfbfb-0000-0000-0000-000000000002', 'Temp Dos', 'temp2@cowin.test', 'consultor', 'f5f5f5f5-0000-0000-0000-000000000001', true);

-- Anónimo
set local role anon;
select throws_ok(
  $$ select public.marcar_contrasena_cambiada() $$,
  '42501', null,
  'Un anónimo no puede ejecutar la función'
);
reset role;

-- Usuario 1
select set_config('request.jwt.claims', '{"sub":"fbfbfbfb-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ update public.perfiles set password_temporal = false where id = 'fbfbfbfb-0000-0000-0000-000000000001' $$,
  '42501', null,
  'El usuario no puede editar password_temporal directamente'
);

-- Quien cambió su contraseña (el hash de auth.users ya es otro) puede desmarcar la
-- bandera. Sin ese cambio la función se niega: eso se prueba en 032.
reset role;
update auth.users set encrypted_password = '$2a$10$hashNuevoUno' where id = 'fbfbfbfb-0000-0000-0000-000000000001';
set local role authenticated;

select lives_ok(
  $$ select public.marcar_contrasena_cambiada() $$,
  'El usuario puede marcar su contraseña como cambiada una vez que la cambió'
);
reset role;

select is(
  (select password_temporal from public.perfiles where id = 'fbfbfbfb-0000-0000-0000-000000000001'),
  false,
  'La bandera del usuario 1 quedó en false'
);
select is(
  (select password_temporal from public.perfiles where id = 'fbfbfbfb-0000-0000-0000-000000000002'),
  true,
  'La bandera del usuario 2 no se tocó'
);

select * from finish();
rollback;
