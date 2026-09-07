// Shared (client + server safe) types for the Super Admin dashboard.
// Client code imports these without dragging supabaseAdmin into the bundle.

export type AdminStats = {
  total_users: number;
  total_guests: number;
  total_games: number;
  active_games: number;
  live_games: number;
  lobby_games: number;
  completed_games: number;
  total_players: number;
  total_squares_claimed: number;
  total_messages: number;
  total_venues: number;
  auto_synced_games: number;
  games_last_7d: number;
  users_last_7d: number;
};

export type AdminGame = {
  id: string;
  name: string;
  sport: string;
  home_team: string;
  away_team: string;
  status: string;
  home_score: number;
  away_score: number;
  invite_code: string;
  created_at: string;
  host_id: string;
  host_name: string | null;
  player_count: number;
  squares_claimed: number;
};

export type AdminUser = {
  id: string;
  display_name: string;
  is_guest: boolean;
  avatar_url: string | null;
  created_at: string;
  games_hosted: number;
  games_joined: number;
  is_super_admin: boolean;
};

export type AdminWinner = {
  game_id: string;
  game_name: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  created_at: string;
  winner_name: string | null;
};

export type AdminOverview = {
  stats: AdminStats;
  games: AdminGame[];
  users: AdminUser[];
  winners: AdminWinner[];
};

// ---- Host management ----

export type ManagedUserRole = "super_admin" | "admin" | "host" | "user";

export type ManagedUser = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  is_guest: boolean;
  created_at: string;
  roles: ManagedUserRole[];
  games_hosted: number;
  last_hosted_at: string | null;
};

export type ManagedUserPage = {
  users: ManagedUser[];
  total: number;
  page: number;
  page_size: number;
};

export type RoleAuditEntry = {
  id: string;
  target_user_id: string;
  target_name: string | null;
  role: ManagedUserRole;
  action: "assigned" | "revoked";
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
};
