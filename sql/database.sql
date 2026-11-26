-- =========================================================
-- BASE DE DATOS: ADD (Control de Deudas y Finanzas)
-- Motor: PostgreSQL (Supabase)
-- =========================================================
-- 1. TABLA DE PERFILES (conectada a Authentication / Google)
create table public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null default 'Usuario',
    correo text,
    ingreso_mensual numeric(12, 2) not null default 0,
    moneda_preferida text not null default 'USD',
    dias_alerta integer not null default 15,
    creado_en timestamptz not null default now()
);
-- 2. TABLA DE DEUDAS
create table public.deudas (
    id bigint generated always as identity primary key,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    acreedor text not null,
    concepto text not null,
    categoria text not null default 'Personal',
    moneda_base text not null default 'USD',
    monto_inicial numeric(12, 2) not null,
    saldo_capital_actual numeric(12, 2) not null,
    interes_pendiente numeric(12, 2) not null default 0,
    tipo_tasa text not null default 'Sin interés',
    tasa_interes numeric(5, 2) not null default 0,
    frecuencia_pago text not null default 'Mensual',
    proxima_fecha_pago date not null,
    estado text not null default 'activa',
    creado_en timestamptz not null default now()
);
-- 3. TABLA DE GASTOS FIJOS Y SUSCRIPCIONES
create table public.suscripciones (
    id bigint generated always as identity primary key,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    nombre text not null,
    categoria text not null default 'Servicios',
    monto numeric(12, 2) not null,
    moneda text not null default 'USD',
    frecuencia text not null default 'Mensual',
    proxima_fecha_pago date not null,
    estado text not null default 'activa',
    creado_en timestamptz not null default now()
);
-- 4. TABLA DE ABONOS E HISTORIAL DE PAGOS
create table public.abonos (
    id bigint generated always as identity primary key,
    usuario_id uuid not null references auth.users(id) on delete cascade,
    deuda_id bigint references public.deudas(id) on delete
    set null,
        suscripcion_id bigint references public.suscripciones(id) on delete
    set null,
        tipo_movimiento text not null default 'Abono Deuda',
        deuda_titulo text not null,
        fecha_pago date not null default current_date,
        monto_abonado numeric(12, 2) not null,
        moneda_pago text not null,
        tasa_cambio_usada text not null,
        pagado_interes numeric(12, 2) not null default 0,
        pagado_capital numeric(12, 2) not null default 0,
        saldo_restante numeric(12, 2) not null default 0,
        creado_en timestamptz not null default now()
);
-- 5. TABLA DE TASAS DE CAMBIO (BCV / USDT)
create table public.tasas_cambio (
    id bigint generated always as identity primary key,
    fecha_dia date unique not null,
    bcv numeric(12, 2) not null,
    usdt numeric(12, 2) not null,
    fuente text not null default 'API',
    actualizado_en timestamptz not null default now()
);
-- ACTIVAR SEGURIDAD POR FILA (RLS)
alter table public.perfiles enable row level security;
alter table public.deudas enable row level security;
alter table public.suscripciones enable row level security;
alter table public.abonos enable row level security;
alter table public.tasas_cambio enable row level security;
-- POLÍTICAS DE ACCESO POR USUARIO
create policy "Ver propio perfil" on public.perfiles for
select using (auth.uid() = id);
create policy "Actualizar propio perfil" on public.perfiles for
update using (auth.uid() = id);
create policy "Insertar propio perfil" on public.perfiles for
insert with check (auth.uid() = id);
create policy "Gestionar propias deudas" on public.deudas for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "Gestionar propias suscripciones" on public.suscripciones for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "Gestionar propios abonos" on public.abonos for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
create policy "Leer tasas" on public.tasas_cambio for
select using (true);
create policy "Guardar tasas usuarios autenticados" on public.tasas_cambio for
insert to authenticated with check (true);
create policy "Actualizar tasas usuarios autenticados" on public.tasas_cambio for
update to authenticated using (true);
-- DISPARADOR AUTOMÁTICO AL REGISTRAR UN USUARIO (CORREO O GOOGLE)
create or replace function public.crear_perfil_nuevo_usuario() returns trigger language plpgsql security definer
set search_path = '' as $$ begin
insert into public.perfiles (id, nombre, correo)
values (
        new.id,
        coalesce(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            split_part(new.email, '@', 1)
        ),
        new.email
    );
return new;
end;
$$;
create trigger al_crear_usuario
after
insert on auth.users for each row execute procedure public.crear_perfil_nuevo_usuario();