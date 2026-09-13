ALTER FUNCTION public.finalize_nfl_board(uuid, uuid, text) SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.reset_nfl_board(uuid, uuid) SET search_path TO 'public', 'extensions';