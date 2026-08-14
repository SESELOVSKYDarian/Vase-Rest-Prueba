insert into public.usuarios (nombre, username, email, rol, activo)
values ('Administrador', 'admin', 'admin@noctua.local', 'admin', true)
on conflict (username) do nothing;
