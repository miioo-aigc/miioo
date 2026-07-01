--
-- PostgreSQL database dump
--

\restrict 8LELDF7RoxdCSeoTNlxSkh9VRvdITSTHwee960BiwSpuwSvEOsgha4DTBrAM9Xx

-- Dumped from database version 16.13 (Homebrew)
-- Dumped by pg_dump version 16.13 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.voice_favorites DROP CONSTRAINT IF EXISTS voice_favorites_voice_id_fkey;
ALTER TABLE IF EXISTS ONLY public.voice_favorites DROP CONSTRAINT IF EXISTS voice_favorites_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.video_clips DROP CONSTRAINT IF EXISTS video_clips_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.video_clips DROP CONSTRAINT IF EXISTS video_clips_storyboard_id_fkey;
ALTER TABLE IF EXISTS ONLY public.video_clips DROP CONSTRAINT IF EXISTS video_clips_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_styles DROP CONSTRAINT IF EXISTS user_styles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.subjects DROP CONSTRAINT IF EXISTS subjects_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.subjects DROP CONSTRAINT IF EXISTS subjects_episode_id_fkey;
ALTER TABLE IF EXISTS ONLY public.subject_images DROP CONSTRAINT IF EXISTS subject_images_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.storyboards DROP CONSTRAINT IF EXISTS storyboards_scene_id_fkey;
ALTER TABLE IF EXISTS ONLY public.storyboards DROP CONSTRAINT IF EXISTS storyboards_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.storyboards DROP CONSTRAINT IF EXISTS storyboards_episode_id_fkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_settings DROP CONSTRAINT IF EXISTS project_settings_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_scripts DROP CONSTRAINT IF EXISTS project_scripts_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_script_messages DROP CONSTRAINT IF EXISTS project_script_messages_project_script_id_fkey;
ALTER TABLE IF EXISTS ONLY public.project_script_histories DROP CONSTRAINT IF EXISTS project_script_histories_project_script_id_fkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.model_configs DROP CONSTRAINT IF EXISTS model_configs_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.model_configs DROP CONSTRAINT IF EXISTS model_configs_provider_id_fkey;
ALTER TABLE IF EXISTS ONLY public.magnets DROP CONSTRAINT IF EXISTS magnets_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_tasks DROP CONSTRAINT IF EXISTS gen_tasks_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_tasks DROP CONSTRAINT IF EXISTS gen_tasks_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_items DROP CONSTRAINT IF EXISTS gen_task_items_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_items DROP CONSTRAINT IF EXISTS gen_task_items_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_items DROP CONSTRAINT IF EXISTS gen_task_items_episode_id_fkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_events DROP CONSTRAINT IF EXISTS gen_task_events_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.voices DROP CONSTRAINT IF EXISTS fk_voices_owner_user_id;
ALTER TABLE IF EXISTS ONLY public.subjects DROP CONSTRAINT IF EXISTS fk_subjects_reference_asset;
ALTER TABLE IF EXISTS ONLY public.subjects DROP CONSTRAINT IF EXISTS fk_subjects_owner;
ALTER TABLE IF EXISTS ONLY public.subject_images DROP CONSTRAINT IF EXISTS fk_subject_images_asset;
ALTER TABLE IF EXISTS ONLY public.episodes DROP CONSTRAINT IF EXISTS episodes_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.creation_shots DROP CONSTRAINT IF EXISTS creation_shots_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.creation_shots DROP CONSTRAINT IF EXISTS creation_shots_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.creation_sessions DROP CONSTRAINT IF EXISTS creation_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.creation_sessions DROP CONSTRAINT IF EXISTS creation_sessions_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compositions DROP CONSTRAINT IF EXISTS compositions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compositions DROP CONSTRAINT IF EXISTS compositions_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audio_clips DROP CONSTRAINT IF EXISTS audio_clips_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audio_clips DROP CONSTRAINT IF EXISTS audio_clips_storyboard_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audio_clips DROP CONSTRAINT IF EXISTS audio_clips_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_project_id_fkey;
ALTER TABLE IF EXISTS ONLY public.api_providers DROP CONSTRAINT IF EXISTS api_providers_user_id_fkey;
DROP INDEX IF EXISTS public.ix_voice_favorites_user_id;
DROP INDEX IF EXISTS public.ix_video_clips_user_id;
DROP INDEX IF EXISTS public.ix_video_clips_project_id;
DROP INDEX IF EXISTS public.ix_users_wechat_openid;
DROP INDEX IF EXISTS public.ix_users_phone;
DROP INDEX IF EXISTS public.ix_user_styles_user_id;
DROP INDEX IF EXISTS public.ix_user_identities_user_id;
DROP INDEX IF EXISTS public.ix_user_identities_provider;
DROP INDEX IF EXISTS public.ix_subjects_project_id;
DROP INDEX IF EXISTS public.ix_subjects_episode_id;
DROP INDEX IF EXISTS public.ix_subject_images_subject_id;
DROP INDEX IF EXISTS public.ix_storyboards_project_id;
DROP INDEX IF EXISTS public.ix_storyboards_episode_id;
DROP INDEX IF EXISTS public.ix_projects_user_id;
DROP INDEX IF EXISTS public.ix_project_settings_project_id;
DROP INDEX IF EXISTS public.ix_project_scripts_project_id;
DROP INDEX IF EXISTS public.ix_project_script_messages_project_script_id;
DROP INDEX IF EXISTS public.ix_project_script_histories_project_script_id;
DROP INDEX IF EXISTS public.ix_notifications_user_id;
DROP INDEX IF EXISTS public.ix_model_configs_user_id;
DROP INDEX IF EXISTS public.ix_magnets_user_id;
DROP INDEX IF EXISTS public.ix_magnets_is_public;
DROP INDEX IF EXISTS public.ix_magnets_created_at;
DROP INDEX IF EXISTS public.ix_gen_tasks_user_id;
DROP INDEX IF EXISTS public.ix_gen_tasks_scope_key;
DROP INDEX IF EXISTS public.ix_gen_tasks_project_id;
DROP INDEX IF EXISTS public.ix_gen_task_items_task_id;
DROP INDEX IF EXISTS public.ix_gen_task_items_project_id;
DROP INDEX IF EXISTS public.ix_gen_task_items_episode_id;
DROP INDEX IF EXISTS public.ix_gen_task_events_task_id;
DROP INDEX IF EXISTS public.ix_episodes_project_id;
DROP INDEX IF EXISTS public.ix_creation_shots_session_id;
DROP INDEX IF EXISTS public.ix_creation_shots_project_id;
DROP INDEX IF EXISTS public.ix_creation_sessions_user_id;
DROP INDEX IF EXISTS public.ix_creation_sessions_project_id;
DROP INDEX IF EXISTS public.ix_compositions_user_id;
DROP INDEX IF EXISTS public.ix_compositions_project_id;
DROP INDEX IF EXISTS public.ix_audio_clips_user_id;
DROP INDEX IF EXISTS public.ix_audio_clips_project_id;
DROP INDEX IF EXISTS public.ix_assets_user_id;
DROP INDEX IF EXISTS public.ix_assets_subject_id;
DROP INDEX IF EXISTS public.ix_assets_project_id;
DROP INDEX IF EXISTS public.ix_assets_is_deleted;
DROP INDEX IF EXISTS public.ix_assets_deleted_at;
DROP INDEX IF EXISTS public.ix_api_providers_user_id;
ALTER TABLE IF EXISTS ONLY public.voices DROP CONSTRAINT IF EXISTS voices_voice_id_key;
ALTER TABLE IF EXISTS ONLY public.voices DROP CONSTRAINT IF EXISTS voices_pkey;
ALTER TABLE IF EXISTS ONLY public.voice_favorites DROP CONSTRAINT IF EXISTS voice_favorites_pkey;
ALTER TABLE IF EXISTS ONLY public.video_clips DROP CONSTRAINT IF EXISTS video_clips_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.user_styles DROP CONSTRAINT IF EXISTS user_styles_pkey;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS user_identities_pkey;
ALTER TABLE IF EXISTS ONLY public.voice_favorites DROP CONSTRAINT IF EXISTS uq_voice_favorites_user_voice;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS uq_user_identities_provider_user;
ALTER TABLE IF EXISTS ONLY public.user_identities DROP CONSTRAINT IF EXISTS uq_user_identities_provider_union;
ALTER TABLE IF EXISTS ONLY public.gen_task_events DROP CONSTRAINT IF EXISTS uq_gen_task_events_task_sequence;
ALTER TABLE IF EXISTS ONLY public.episodes DROP CONSTRAINT IF EXISTS uq_episode_number;
ALTER TABLE IF EXISTS ONLY public.subjects DROP CONSTRAINT IF EXISTS subjects_pkey;
ALTER TABLE IF EXISTS ONLY public.subject_images DROP CONSTRAINT IF EXISTS subject_images_pkey;
ALTER TABLE IF EXISTS ONLY public.storyboards DROP CONSTRAINT IF EXISTS storyboards_pkey;
ALTER TABLE IF EXISTS ONLY public.reference_audio_library_items DROP CONSTRAINT IF EXISTS reference_audio_library_items_pkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_pkey;
ALTER TABLE IF EXISTS ONLY public.project_settings DROP CONSTRAINT IF EXISTS project_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.project_scripts DROP CONSTRAINT IF EXISTS project_scripts_project_id_key;
ALTER TABLE IF EXISTS ONLY public.project_scripts DROP CONSTRAINT IF EXISTS project_scripts_pkey;
ALTER TABLE IF EXISTS ONLY public.project_script_messages DROP CONSTRAINT IF EXISTS project_script_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.project_script_histories DROP CONSTRAINT IF EXISTS project_script_histories_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.model_configs DROP CONSTRAINT IF EXISTS model_configs_pkey;
ALTER TABLE IF EXISTS ONLY public.magnets DROP CONSTRAINT IF EXISTS magnets_pkey;
ALTER TABLE IF EXISTS ONLY public.gen_tasks DROP CONSTRAINT IF EXISTS gen_tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_items DROP CONSTRAINT IF EXISTS gen_task_items_pkey;
ALTER TABLE IF EXISTS ONLY public.gen_task_events DROP CONSTRAINT IF EXISTS gen_task_events_pkey;
ALTER TABLE IF EXISTS ONLY public.episodes DROP CONSTRAINT IF EXISTS episodes_pkey;
ALTER TABLE IF EXISTS ONLY public.creation_shots DROP CONSTRAINT IF EXISTS creation_shots_pkey;
ALTER TABLE IF EXISTS ONLY public.creation_sessions DROP CONSTRAINT IF EXISTS creation_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.compositions DROP CONSTRAINT IF EXISTS compositions_pkey;
ALTER TABLE IF EXISTS ONLY public.community_qr_configs DROP CONSTRAINT IF EXISTS community_qr_configs_pkey;
ALTER TABLE IF EXISTS ONLY public.audio_clips DROP CONSTRAINT IF EXISTS audio_clips_pkey;
ALTER TABLE IF EXISTS ONLY public.assets DROP CONSTRAINT IF EXISTS assets_pkey;
ALTER TABLE IF EXISTS ONLY public.api_providers DROP CONSTRAINT IF EXISTS api_providers_pkey;
ALTER TABLE IF EXISTS ONLY public.api_config_card_visibility DROP CONSTRAINT IF EXISTS api_config_card_visibility_pkey;
ALTER TABLE IF EXISTS ONLY public.api_config_card_visibility DROP CONSTRAINT IF EXISTS api_config_card_visibility_card_key_key;
ALTER TABLE IF EXISTS ONLY public.api_config_banners DROP CONSTRAINT IF EXISTS api_config_banners_pkey;
ALTER TABLE IF EXISTS ONLY public.alembic_version DROP CONSTRAINT IF EXISTS alembic_version_pkc;
DROP TABLE IF EXISTS public.voices;
DROP TABLE IF EXISTS public.voice_favorites;
DROP TABLE IF EXISTS public.video_clips;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_styles;
DROP TABLE IF EXISTS public.user_identities;
DROP TABLE IF EXISTS public.subjects;
DROP TABLE IF EXISTS public.subject_images;
DROP TABLE IF EXISTS public.storyboards;
DROP TABLE IF EXISTS public.reference_audio_library_items;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.project_settings;
DROP TABLE IF EXISTS public.project_scripts;
DROP TABLE IF EXISTS public.project_script_messages;
DROP TABLE IF EXISTS public.project_script_histories;
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.model_configs;
DROP TABLE IF EXISTS public.magnets;
DROP TABLE IF EXISTS public.gen_tasks;
DROP TABLE IF EXISTS public.gen_task_items;
DROP TABLE IF EXISTS public.gen_task_events;
DROP TABLE IF EXISTS public.episodes;
DROP TABLE IF EXISTS public.creation_shots;
DROP TABLE IF EXISTS public.creation_sessions;
DROP TABLE IF EXISTS public.compositions;
DROP TABLE IF EXISTS public.community_qr_configs;
DROP TABLE IF EXISTS public.audio_clips;
DROP TABLE IF EXISTS public.assets;
DROP TABLE IF EXISTS public.api_providers;
DROP TABLE IF EXISTS public.api_config_card_visibility;
DROP TABLE IF EXISTS public.api_config_banners;
DROP TABLE IF EXISTS public.alembic_version;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: api_config_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_config_banners (
    id uuid NOT NULL,
    image_url character varying(500),
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: api_config_card_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_config_card_visibility (
    id uuid NOT NULL,
    card_key character varying(50) NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: api_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_providers (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    provider_type character varying(50) NOT NULL,
    base_url character varying(500),
    api_key_encrypted text NOT NULL,
    is_enabled boolean NOT NULL,
    is_connected boolean NOT NULL,
    last_tested_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    default_image_watermark boolean NOT NULL,
    default_video_watermark boolean NOT NULL,
    secondary_base_url character varying(500),
    secondary_api_key_encrypted text,
    credential_mode character varying(50)
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    subject_id uuid,
    name character varying(200) NOT NULL,
    asset_type character varying(20) NOT NULL,
    category character varying(20) NOT NULL,
    file_url character varying(500) NOT NULL,
    thumbnail_url character varying(500),
    prompt text,
    model character varying(50),
    size character varying(20),
    is_primary boolean DEFAULT false NOT NULL,
    is_starred boolean DEFAULT false NOT NULL,
    metadata_json json,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    description text,
    reference_image_urls json,
    is_deleted boolean NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: audio_clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audio_clips (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    storyboard_id uuid,
    text text NOT NULL,
    voice_id character varying(100) NOT NULL,
    audio_url character varying(500) NOT NULL,
    duration double precision NOT NULL,
    speed double precision DEFAULT '1'::double precision NOT NULL,
    emotion character varying(30),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    is_favorite boolean DEFAULT false NOT NULL,
    source character varying(50)
);


--
-- Name: community_qr_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_qr_configs (
    id uuid NOT NULL,
    image_url character varying(500),
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: compositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compositions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    timeline json,
    subtitle_style json,
    resolution character varying(20) DEFAULT '1080p'::character varying NOT NULL,
    aspect_ratio character varying(10) DEFAULT '16:9'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    output_url character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: creation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creation_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    title character varying(200) NOT NULL,
    description text,
    aspect_ratio character varying(10) DEFAULT '16:9'::character varying NOT NULL,
    visual_style character varying(100),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    metadata_json json,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: creation_shots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creation_shots (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    project_id uuid,
    shot_number integer DEFAULT 1 NOT NULL,
    title character varying(200),
    content text,
    shot_type character varying(20),
    camera character varying(20),
    camera_angle character varying(20),
    composition character varying(20),
    duration double precision,
    prompt text,
    image_url character varying(500),
    audio_url character varying(500),
    video_url character varying(500),
    reference_image_urls json,
    metadata_json json,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episodes (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    episode_number integer NOT NULL,
    content text,
    summary text,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gen_task_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gen_task_events (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    sequence integer NOT NULL,
    event_type character varying(30) NOT NULL,
    payload json,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gen_task_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gen_task_items (
    id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid,
    episode_id uuid,
    item_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    payload json,
    result_ref_type character varying(50),
    result_ref_id character varying(100),
    error_message text,
    started_at timestamp without time zone,
    finished_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gen_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gen_tasks (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    task_type character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    fail_count integer DEFAULT 0 NOT NULL,
    model character varying(200),
    size character varying(20),
    params json,
    results json,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    scope_key character varying(200),
    current_stage character varying(50),
    heartbeat_at timestamp without time zone
);


--
-- Name: magnets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.magnets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(120),
    content text NOT NULL,
    elements_json json,
    style_json json,
    generated_image_url character varying(500),
    reference_image_urls json,
    ai_provider character varying(120),
    ai_model character varying(200),
    is_public boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: model_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_configs (
    id uuid NOT NULL,
    provider_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    model_id character varying(200) NOT NULL,
    category character varying(20) NOT NULL,
    description character varying(500),
    is_enabled boolean NOT NULL,
    is_default boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    title character varying(200) NOT NULL,
    content text,
    link character varying(500),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: project_script_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_script_histories (
    id uuid NOT NULL,
    project_script_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    source_type character varying(20) NOT NULL,
    source_detail character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    snapshot_type character varying(30) NOT NULL,
    snapshot_payload json
);


--
-- Name: project_script_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_script_messages (
    id uuid NOT NULL,
    project_script_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    message_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_scripts (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    source_type character varying(20) NOT NULL,
    title character varying(200),
    content text,
    parsed_content text,
    status character varying(30) NOT NULL,
    last_uploaded_filename character varying(255),
    last_uploaded_file_type character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_settings (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    script_tone character varying(50) NOT NULL,
    dialogue_density character varying(20) NOT NULL,
    shot_rhythm character varying(20) NOT NULL,
    character_consistency boolean NOT NULL,
    scene_consistency boolean NOT NULL,
    output_format character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    cover_url character varying(500),
    aspect_ratio character varying(10) NOT NULL,
    visual_style character varying(50) NOT NULL,
    project_type character varying(50),
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    language character varying(20) DEFAULT 'zh'::character varying NOT NULL,
    notes text,
    cover_thumbnail_url character varying(500)
);


--
-- Name: reference_audio_library_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reference_audio_library_items (
    id uuid NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    audio_url character varying(500) NOT NULL,
    preview_url character varying(500),
    gender character varying(20),
    age_group character varying(30),
    language character varying(20),
    emotion character varying(50),
    tags_json json,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: storyboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storyboards (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    episode_id uuid,
    shot_number integer NOT NULL,
    content text,
    shot_type character varying(20),
    camera character varying(20),
    duration double precision,
    image_prompt text,
    image_url character varying(500),
    character_ids json,
    scene_id uuid,
    prop_ids json,
    reference_image_urls json,
    gen_params json,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    camera_angle character varying(20),
    composition character varying(20),
    lighting text,
    ambient_sound text,
    voiceover text,
    video_url character varying(500)
);


--
-- Name: subject_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_images (
    id uuid NOT NULL,
    subject_id uuid NOT NULL,
    image_url character varying(500) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    prompt text,
    model character varying(50),
    size character varying(20),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    asset_id uuid,
    generation_mode character varying(20)
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    episode_id uuid,
    type character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(50),
    description text,
    appearance text,
    personality text,
    prompt text,
    image_url character varying(500),
    sort_order integer NOT NULL,
    is_global boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    age character varying(30),
    gender character varying(20),
    background text,
    scene_type character varying(30),
    time_setting character varying(30),
    atmosphere text,
    importance character varying(20),
    owner_subject_id uuid,
    reference_image_url character varying(500),
    reference_asset_id uuid,
    gen_config json,
    voice_id character varying(100)
);


--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identities (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    union_id character varying(255),
    nickname character varying(100),
    avatar_url character varying(500),
    metadata_json json,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_styles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_styles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    prompt text NOT NULL,
    color character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    phone character varying(20) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nickname character varying(50) NOT NULL,
    avatar_url character varying(500),
    is_active boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_admin boolean NOT NULL,
    is_phone_bound boolean NOT NULL,
    wechat_openid character varying(100),
    wechat_nickname character varying(50),
    wechat_avatar_url character varying(500),
    wechat_bound_at timestamp without time zone
);


--
-- Name: video_clips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_clips (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    storyboard_id uuid,
    video_url character varying(500) NOT NULL,
    duration double precision NOT NULL,
    model character varying(50),
    prompt text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_favorites (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    voice_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: voices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voices (
    id uuid NOT NULL,
    voice_id character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    gender character varying(10),
    age_group character varying(20),
    language character varying(20),
    style character varying(50),
    preview_url character varying(500),
    provider character varying(50) DEFAULT 'onelinkai'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    emotions character varying(500),
    is_custom boolean DEFAULT false NOT NULL,
    owner_user_id uuid,
    provider_voice_id character varying(100),
    clone_status character varying(20),
    source_audio_url character varying(500),
    provider_file_id character varying(200),
    provider_task_id character varying(200),
    expires_at timestamp without time zone,
    metadata_json json,
    is_enabled boolean NOT NULL,
    sort_order integer NOT NULL,
    created_by uuid,
    updated_by uuid,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: api_config_banners api_config_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_config_banners
    ADD CONSTRAINT api_config_banners_pkey PRIMARY KEY (id);


--
-- Name: api_config_card_visibility api_config_card_visibility_card_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_config_card_visibility
    ADD CONSTRAINT api_config_card_visibility_card_key_key UNIQUE (card_key);


--
-- Name: api_config_card_visibility api_config_card_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_config_card_visibility
    ADD CONSTRAINT api_config_card_visibility_pkey PRIMARY KEY (id);


--
-- Name: api_providers api_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_providers
    ADD CONSTRAINT api_providers_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audio_clips audio_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_pkey PRIMARY KEY (id);


--
-- Name: community_qr_configs community_qr_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_qr_configs
    ADD CONSTRAINT community_qr_configs_pkey PRIMARY KEY (id);


--
-- Name: compositions compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compositions
    ADD CONSTRAINT compositions_pkey PRIMARY KEY (id);


--
-- Name: creation_sessions creation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_sessions
    ADD CONSTRAINT creation_sessions_pkey PRIMARY KEY (id);


--
-- Name: creation_shots creation_shots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_shots
    ADD CONSTRAINT creation_shots_pkey PRIMARY KEY (id);


--
-- Name: episodes episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);


--
-- Name: gen_task_events gen_task_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_events
    ADD CONSTRAINT gen_task_events_pkey PRIMARY KEY (id);


--
-- Name: gen_task_items gen_task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_items
    ADD CONSTRAINT gen_task_items_pkey PRIMARY KEY (id);


--
-- Name: gen_tasks gen_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_tasks
    ADD CONSTRAINT gen_tasks_pkey PRIMARY KEY (id);


--
-- Name: magnets magnets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magnets
    ADD CONSTRAINT magnets_pkey PRIMARY KEY (id);


--
-- Name: model_configs model_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs
    ADD CONSTRAINT model_configs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_script_histories project_script_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_script_histories
    ADD CONSTRAINT project_script_histories_pkey PRIMARY KEY (id);


--
-- Name: project_script_messages project_script_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_script_messages
    ADD CONSTRAINT project_script_messages_pkey PRIMARY KEY (id);


--
-- Name: project_scripts project_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scripts
    ADD CONSTRAINT project_scripts_pkey PRIMARY KEY (id);


--
-- Name: project_scripts project_scripts_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scripts
    ADD CONSTRAINT project_scripts_project_id_key UNIQUE (project_id);


--
-- Name: project_settings project_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_settings
    ADD CONSTRAINT project_settings_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: reference_audio_library_items reference_audio_library_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_audio_library_items
    ADD CONSTRAINT reference_audio_library_items_pkey PRIMARY KEY (id);


--
-- Name: storyboards storyboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_pkey PRIMARY KEY (id);


--
-- Name: subject_images subject_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_images
    ADD CONSTRAINT subject_images_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: episodes uq_episode_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT uq_episode_number UNIQUE (project_id, episode_number);


--
-- Name: gen_task_events uq_gen_task_events_task_sequence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_events
    ADD CONSTRAINT uq_gen_task_events_task_sequence UNIQUE (task_id, sequence);


--
-- Name: user_identities uq_user_identities_provider_union; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT uq_user_identities_provider_union UNIQUE (provider, union_id);


--
-- Name: user_identities uq_user_identities_provider_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT uq_user_identities_provider_user UNIQUE (provider, provider_user_id);


--
-- Name: voice_favorites uq_voice_favorites_user_voice; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_favorites
    ADD CONSTRAINT uq_voice_favorites_user_voice UNIQUE (user_id, voice_id);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_styles user_styles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_styles
    ADD CONSTRAINT user_styles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_clips video_clips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_clips
    ADD CONSTRAINT video_clips_pkey PRIMARY KEY (id);


--
-- Name: voice_favorites voice_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_favorites
    ADD CONSTRAINT voice_favorites_pkey PRIMARY KEY (id);


--
-- Name: voices voices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voices
    ADD CONSTRAINT voices_pkey PRIMARY KEY (id);


--
-- Name: voices voices_voice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voices
    ADD CONSTRAINT voices_voice_id_key UNIQUE (voice_id);


--
-- Name: ix_api_providers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_api_providers_user_id ON public.api_providers USING btree (user_id);


--
-- Name: ix_assets_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assets_deleted_at ON public.assets USING btree (deleted_at);


--
-- Name: ix_assets_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assets_is_deleted ON public.assets USING btree (is_deleted);


--
-- Name: ix_assets_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assets_project_id ON public.assets USING btree (project_id);


--
-- Name: ix_assets_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assets_subject_id ON public.assets USING btree (subject_id);


--
-- Name: ix_assets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assets_user_id ON public.assets USING btree (user_id);


--
-- Name: ix_audio_clips_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audio_clips_project_id ON public.audio_clips USING btree (project_id);


--
-- Name: ix_audio_clips_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audio_clips_user_id ON public.audio_clips USING btree (user_id);


--
-- Name: ix_compositions_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compositions_project_id ON public.compositions USING btree (project_id);


--
-- Name: ix_compositions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_compositions_user_id ON public.compositions USING btree (user_id);


--
-- Name: ix_creation_sessions_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_creation_sessions_project_id ON public.creation_sessions USING btree (project_id);


--
-- Name: ix_creation_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_creation_sessions_user_id ON public.creation_sessions USING btree (user_id);


--
-- Name: ix_creation_shots_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_creation_shots_project_id ON public.creation_shots USING btree (project_id);


--
-- Name: ix_creation_shots_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_creation_shots_session_id ON public.creation_shots USING btree (session_id);


--
-- Name: ix_episodes_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_episodes_project_id ON public.episodes USING btree (project_id);


--
-- Name: ix_gen_task_events_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_task_events_task_id ON public.gen_task_events USING btree (task_id);


--
-- Name: ix_gen_task_items_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_task_items_episode_id ON public.gen_task_items USING btree (episode_id);


--
-- Name: ix_gen_task_items_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_task_items_project_id ON public.gen_task_items USING btree (project_id);


--
-- Name: ix_gen_task_items_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_task_items_task_id ON public.gen_task_items USING btree (task_id);


--
-- Name: ix_gen_tasks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_tasks_project_id ON public.gen_tasks USING btree (project_id);


--
-- Name: ix_gen_tasks_scope_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_tasks_scope_key ON public.gen_tasks USING btree (scope_key);


--
-- Name: ix_gen_tasks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_gen_tasks_user_id ON public.gen_tasks USING btree (user_id);


--
-- Name: ix_magnets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_magnets_created_at ON public.magnets USING btree (created_at);


--
-- Name: ix_magnets_is_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_magnets_is_public ON public.magnets USING btree (is_public);


--
-- Name: ix_magnets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_magnets_user_id ON public.magnets USING btree (user_id);


--
-- Name: ix_model_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_model_configs_user_id ON public.model_configs USING btree (user_id);


--
-- Name: ix_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: ix_project_script_histories_project_script_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_script_histories_project_script_id ON public.project_script_histories USING btree (project_script_id);


--
-- Name: ix_project_script_messages_project_script_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_script_messages_project_script_id ON public.project_script_messages USING btree (project_script_id);


--
-- Name: ix_project_scripts_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_project_scripts_project_id ON public.project_scripts USING btree (project_id);


--
-- Name: ix_project_settings_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_project_settings_project_id ON public.project_settings USING btree (project_id);


--
-- Name: ix_projects_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_projects_user_id ON public.projects USING btree (user_id);


--
-- Name: ix_storyboards_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_storyboards_episode_id ON public.storyboards USING btree (episode_id);


--
-- Name: ix_storyboards_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_storyboards_project_id ON public.storyboards USING btree (project_id);


--
-- Name: ix_subject_images_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subject_images_subject_id ON public.subject_images USING btree (subject_id);


--
-- Name: ix_subjects_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subjects_episode_id ON public.subjects USING btree (episode_id);


--
-- Name: ix_subjects_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subjects_project_id ON public.subjects USING btree (project_id);


--
-- Name: ix_user_identities_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_identities_provider ON public.user_identities USING btree (provider);


--
-- Name: ix_user_identities_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_identities_user_id ON public.user_identities USING btree (user_id);


--
-- Name: ix_user_styles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_styles_user_id ON public.user_styles USING btree (user_id);


--
-- Name: ix_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone);


--
-- Name: ix_users_wechat_openid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_wechat_openid ON public.users USING btree (wechat_openid) WHERE (wechat_openid IS NOT NULL);


--
-- Name: ix_video_clips_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_video_clips_project_id ON public.video_clips USING btree (project_id);


--
-- Name: ix_video_clips_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_video_clips_user_id ON public.video_clips USING btree (user_id);


--
-- Name: ix_voice_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_voice_favorites_user_id ON public.voice_favorites USING btree (user_id);


--
-- Name: api_providers api_providers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_providers
    ADD CONSTRAINT api_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: assets assets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: assets assets_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;


--
-- Name: assets assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audio_clips audio_clips_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: audio_clips audio_clips_storyboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_storyboard_id_fkey FOREIGN KEY (storyboard_id) REFERENCES public.storyboards(id) ON DELETE SET NULL;


--
-- Name: audio_clips audio_clips_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audio_clips
    ADD CONSTRAINT audio_clips_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: compositions compositions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compositions
    ADD CONSTRAINT compositions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: compositions compositions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compositions
    ADD CONSTRAINT compositions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: creation_sessions creation_sessions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_sessions
    ADD CONSTRAINT creation_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: creation_sessions creation_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_sessions
    ADD CONSTRAINT creation_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: creation_shots creation_shots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_shots
    ADD CONSTRAINT creation_shots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: creation_shots creation_shots_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_shots
    ADD CONSTRAINT creation_shots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.creation_sessions(id) ON DELETE CASCADE;


--
-- Name: episodes episodes_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: subject_images fk_subject_images_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_images
    ADD CONSTRAINT fk_subject_images_asset FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: subjects fk_subjects_owner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_subjects_owner FOREIGN KEY (owner_subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;


--
-- Name: subjects fk_subjects_reference_asset; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_subjects_reference_asset FOREIGN KEY (reference_asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: voices fk_voices_owner_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voices
    ADD CONSTRAINT fk_voices_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: gen_task_events gen_task_events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_events
    ADD CONSTRAINT gen_task_events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.gen_tasks(id) ON DELETE CASCADE;


--
-- Name: gen_task_items gen_task_items_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_items
    ADD CONSTRAINT gen_task_items_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: gen_task_items gen_task_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_items
    ADD CONSTRAINT gen_task_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: gen_task_items gen_task_items_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_task_items
    ADD CONSTRAINT gen_task_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.gen_tasks(id) ON DELETE CASCADE;


--
-- Name: gen_tasks gen_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_tasks
    ADD CONSTRAINT gen_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: gen_tasks gen_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gen_tasks
    ADD CONSTRAINT gen_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: magnets magnets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.magnets
    ADD CONSTRAINT magnets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: model_configs model_configs_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs
    ADD CONSTRAINT model_configs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.api_providers(id) ON DELETE CASCADE;


--
-- Name: model_configs model_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs
    ADD CONSTRAINT model_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_script_histories project_script_histories_project_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_script_histories
    ADD CONSTRAINT project_script_histories_project_script_id_fkey FOREIGN KEY (project_script_id) REFERENCES public.project_scripts(id) ON DELETE CASCADE;


--
-- Name: project_script_messages project_script_messages_project_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_script_messages
    ADD CONSTRAINT project_script_messages_project_script_id_fkey FOREIGN KEY (project_script_id) REFERENCES public.project_scripts(id) ON DELETE CASCADE;


--
-- Name: project_scripts project_scripts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_scripts
    ADD CONSTRAINT project_scripts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_settings project_settings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_settings
    ADD CONSTRAINT project_settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: storyboards storyboards_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: storyboards storyboards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: storyboards storyboards_scene_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES public.subjects(id) ON DELETE SET NULL;


--
-- Name: subject_images subject_images_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_images
    ADD CONSTRAINT subject_images_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episodes(id) ON DELETE SET NULL;


--
-- Name: subjects subjects_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_styles user_styles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_styles
    ADD CONSTRAINT user_styles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: video_clips video_clips_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_clips
    ADD CONSTRAINT video_clips_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: video_clips video_clips_storyboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_clips
    ADD CONSTRAINT video_clips_storyboard_id_fkey FOREIGN KEY (storyboard_id) REFERENCES public.storyboards(id) ON DELETE SET NULL;


--
-- Name: video_clips video_clips_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_clips
    ADD CONSTRAINT video_clips_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: voice_favorites voice_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_favorites
    ADD CONSTRAINT voice_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: voice_favorites voice_favorites_voice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_favorites
    ADD CONSTRAINT voice_favorites_voice_id_fkey FOREIGN KEY (voice_id) REFERENCES public.voices(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 8LELDF7RoxdCSeoTNlxSkh9VRvdITSTHwee960BiwSpuwSvEOsgha4DTBrAM9Xx

