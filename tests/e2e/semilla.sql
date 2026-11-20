-- Datos deterministas para el e2e: Hito (público, con una caída de 45 min hace 10 h)
-- y una API de ejemplo con un incidente abierto.
delete from products;
with p as (insert into products (name, slug, repo, is_public) values ('Hito', 'hito', 'MaxAcosta-30/hito', true) returning id),
e as (insert into endpoints (product_id, url, max_latency_ms) select id, 'https://hito.ejemplo.com/salud', 800 from p returning id)
insert into checks (endpoint_id, checked_at, ok, status, latency_ms)
select e.id, now() - (g * interval '15 minutes'), g not in (40, 41, 42), case when g in (40, 41, 42) then 503 else 200 end, 180 + (g % 7) * 20
from e, generate_series(0, 95) g;
insert into incidents (endpoint_id, opened_at, closed_at, reason)
select id, now() - interval '10 hours 30 minutes', now() - interval '9 hours 45 minutes', 'Respondió 503' from endpoints;
with p as (insert into products (name, slug, repo, is_public) values ('API de ejemplo', 'api-ejemplo', 'ejemplo/api', false) returning id),
e as (insert into endpoints (product_id, url, max_latency_ms) select id, 'https://api.ejemplo.com/salud', 500 from p returning id)
insert into checks (endpoint_id, checked_at, ok, status, latency_ms)
select e.id, now() - (g * interval '15 minutes'), g > 3, case when g > 3 then 200 else 500 end, 300 from e, generate_series(0, 95) g;
insert into incidents (endpoint_id, opened_at, reason)
select e.id, now() - interval '50 minutes', 'Respondió 500; se esperaba 200'
from endpoints e join products p on p.id = e.product_id where p.slug = 'api-ejemplo';
insert into monitor_runs (started_at, finished_at, checked, failed) values (now() - interval '3 minutes', now() - interval '3 minutes', 2, 1);
