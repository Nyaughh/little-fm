export interface CurrentTrack {
  artist: string;
  title: string;
  album?: string;
  image?: string;
  imageCandidates?: string[];
  albumMbid?: string;
  coverImage?: string;
  url?: string;
  isNowPlaying: boolean;
  timestamp?: string;
  playedAt?: number;
}

export interface UserTrack {
  username: string;
  currentTrack: CurrentTrack | null;
  error?: string;
  checkedAt?: number;
}
