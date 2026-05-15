// Fixed commentator personality presets. Each preset maps to a HeyGen avatar
// and voice. IDs live server-side too — keep this file pure data so it can be
// imported from both client and server modules.

export type CommentatorPreset = {
  name: string;
  description: string;
  voiceStyle: string;
  catchphrase: string;
  heygenAvatarId: string;
  heygenVoiceId: string;
};

export const COMMENTATORS: CommentatorPreset[] = [
  {
    name: "Coach Chaos",
    description: "Hype Announcer",
    voiceStyle: "Energetic",
    catchphrase: "That square is heating up!",
    heygenAvatarId: "ad582f0d8b9e4341bd6cdf58602f4367",
    heygenVoiceId: "603ec47e80504ffc9f27b7b86435dbc7",
  },
  {
    name: "Big Mike",
    description: "Trash Talk Uncle",
    voiceStyle: "Deep Voice",
    catchphrase: "Y'all not ready for this!",
    heygenAvatarId: "f7d50bee898c44c5acc986fb7992afe6",
    heygenVoiceId: "603ec47e80504ffc9f27b7b86435dbc7",
  },
  {
    name: "Crystal Courtside",
    description: "ESPN Analyst",
    voiceStyle: "Professional",
    catchphrase: "Watch the spacing — that opens the corner.",
    heygenAvatarId: "Imelda_Casual_Front_public",
    heygenVoiceId: "1b4dd4370bca4e169d4097d723c344f9",
  },
  {
    name: "Twitch Ty",
    description: "Twitch Streamer",
    voiceStyle: "Funny",
    catchphrase: "Pog moment incoming!",
    heygenAvatarId: "6569e4a0c24d459bb8420078b9e071df",
    heygenVoiceId: "8c425c31ed5e4b79a7f17d4c5aa95c8d",
  },
  {
    name: "Rival Rion",
    description: "Rival Fan",
    voiceStyle: "Dramatic",
    catchphrase: "Your team is cooked.",
    heygenAvatarId: "Timothy_sitting_office_front",
    heygenVoiceId: "5d8c378ba8c3434586081a52ac368738",
  },
];

export const COMMENTATOR_NAMES = COMMENTATORS.map((c) => c.name);

export function getCommentatorByName(name: string | null | undefined): CommentatorPreset | undefined {
  if (!name) return undefined;
  return COMMENTATORS.find((c) => c.name === name);
}
