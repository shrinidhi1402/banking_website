-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  phone character varying,
  password_hash text NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['CUSTOMER'::character varying, 'EMPLOYEE'::character varying, 'MANAGER'::character varying]::text[])),
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'LOCKED'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_login timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.customer_profiles (
  id bigint NOT NULL DEFAULT nextval('customer_profiles_id_seq'::regclass),
  user_id bigint NOT NULL UNIQUE,
  customer_id character varying NOT NULL UNIQUE,
  date_of_birth date,
  address text,
  city character varying,
  state character varying,
  postal_code character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT customer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.employee_profiles (
  id bigint NOT NULL DEFAULT nextval('employee_profiles_id_seq'::regclass),
  user_id bigint NOT NULL UNIQUE,
  employee_id character varying NOT NULL UNIQUE,
  department character varying,
  designation character varying,
  branch character varying,
  joining_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT employee_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.manager_profiles (
  id bigint NOT NULL DEFAULT nextval('manager_profiles_id_seq'::regclass),
  user_id bigint NOT NULL UNIQUE,
  manager_id character varying NOT NULL UNIQUE,
  designation character varying,
  branch character varying,
  approval_limit numeric DEFAULT 0,
  joining_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT manager_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT manager_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.accounts (
  id bigint NOT NULL DEFAULT nextval('accounts_id_seq'::regclass),
  user_id bigint NOT NULL,
  account_number character varying NOT NULL UNIQUE,
  account_type character varying NOT NULL DEFAULT 'SAVINGS'::character varying CHECK (account_type::text = ANY (ARRAY['SAVINGS'::character varying, 'CURRENT'::character varying]::text[])),
  balance numeric NOT NULL DEFAULT 0.00 CHECK (balance >= 0::numeric),
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'FROZEN'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.beneficiaries (
  id bigint NOT NULL DEFAULT nextval('beneficiaries_id_seq'::regclass),
  user_id bigint NOT NULL,
  beneficiary_name character varying NOT NULL,
  account_number character varying NOT NULL,
  bank_name character varying NOT NULL,
  ifsc character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT beneficiaries_pkey PRIMARY KEY (id),
  CONSTRAINT beneficiaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.transactions (
  id bigint NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  sender_account_id bigint,
  receiver_account_id bigint,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  transaction_type character varying NOT NULL DEFAULT 'TRANSFER'::character varying,
  status character varying NOT NULL DEFAULT 'SUCCESS'::character varying CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'SUCCESS'::character varying, 'FAILED'::character varying, 'REVERSED'::character varying]::text[])),
  description text,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_sender_account_id_fkey FOREIGN KEY (sender_account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_receiver_account_id_fkey FOREIGN KEY (receiver_account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.requests (
  id bigint NOT NULL DEFAULT nextval('requests_id_seq'::regclass),
  user_id bigint NOT NULL,
  request_type character varying NOT NULL,
  description text,
  status character varying NOT NULL DEFAULT 'PENDING'::character varying CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying]::text[])),
  processed_by bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT requests_pkey PRIMARY KEY (id),
  CONSTRAINT requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id)
);
CREATE TABLE public.login_events (
  id bigint NOT NULL DEFAULT nextval('login_events_id_seq'::regclass),
  user_id bigint,
  ip_address inet,
  device text,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT login_events_pkey PRIMARY KEY (id),
  CONSTRAINT login_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.security_events (
  id bigint NOT NULL DEFAULT nextval('security_events_id_seq'::regclass),
  user_id bigint,
  event_type character varying NOT NULL,
  severity character varying NOT NULL DEFAULT 'LOW'::character varying CHECK (severity::text = ANY (ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying]::text[])),
  description text,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT security_events_pkey PRIMARY KEY (id),
  CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.audit_logs (
  id bigint NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  user_id bigint,
  role character varying,
  action character varying NOT NULL,
  resource character varying,
  resource_id bigint,
  ip_address inet,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.otp_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT otp_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT otp_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.knowledge_chunks (
  id bigint NOT NULL DEFAULT nextval('knowledge_chunks_id_seq'::regclass),
  source text NOT NULL,
  section text,
  framework text,
  content text NOT NULL,
  embedding USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id)
);