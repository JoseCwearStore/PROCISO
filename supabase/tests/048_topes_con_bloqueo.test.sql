-- AUD10-M5 y M6: los topes diarios (IA, video, soporte y transcripciones) contaban sin bloqueo: dos pedidos a la vez veían
-- el mismo conteo y los dos pasaban, así que el tope se podía exceder (para el video, que es lo más caro, importa).
-- Ahora cada tope toma un `pg_advisory_xact_lock` por usuario (y por consultoría, en IA) ANTES de contar: el segundo pedido
-- espera a que el primero termine y recién ahí cuenta, ya con el primero incluido.
-- pgTAP corre en una sola conexión y no puede probar la espera entre dos transacciones: acá se fija que el bloqueo esté
-- puesto en cada función y que la tabla de pedidos no se pueda tocar por la API. La prueba de concurrencia real, con dos
-- conexiones a la vez, es herramientas/probar_concurrencia_topes.mjs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(pg_get_functiondef('private.aplicar_tope_ia()'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''ia:usuario:''%',
  'El tope de IA (y de video) bloquea por usuario antes de contar');
select ok(pg_get_functiondef('private.aplicar_tope_ia()'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''ia:consultoria:''%',
  'El tope de IA también bloquea por consultoría (el tope de la consultoría se comparte entre usuarios)');
select ok(
  strpos(pg_get_functiondef('private.aplicar_tope_ia()'::regprocedure), 'pg_advisory_xact_lock') > 0
  and strpos(pg_get_functiondef('private.aplicar_tope_ia()'::regprocedure), 'pg_advisory_xact_lock')
    < strpos(pg_get_functiondef('private.aplicar_tope_ia()'::regprocedure), 'private.uso_ia('),
  'El bloqueo se toma ANTES de contar el uso');
select ok(pg_get_functiondef('private.aplicar_tope_soporte()'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''soporte:usuario:''%',
  'El tope de soporte bloquea por usuario antes de contar');
select ok(pg_get_functiondef('public.autorizar_transcripcion(uuid)'::regprocedure) like '%pg_advisory_xact_lock(hashtextextended(''transcripcion:''%',
  'Autorizar una transcripción bloquea por usuario antes de contar');
select ok(
  strpos(pg_get_functiondef('public.autorizar_transcripcion(uuid)'::regprocedure), 'pg_advisory_xact_lock') > 0
  and strpos(pg_get_functiondef('public.autorizar_transcripcion(uuid)'::regprocedure), 'pg_advisory_xact_lock')
    < strpos(pg_get_functiondef('public.autorizar_transcripcion(uuid)'::regprocedure), 'from private.pedidos_transcripcion'),
  'En transcripciones el bloqueo también va antes de contar');

select ok(not has_table_privilege('authenticated', 'private.pedidos_transcripcion', 'select, insert, update, delete'),
  'Un usuario autenticado no toca la tabla de pedidos de transcripción');
select ok(not has_table_privilege('anon', 'private.pedidos_transcripcion', 'select, insert, update, delete'),
  'Un anónimo tampoco');

select * from finish();
rollback;
