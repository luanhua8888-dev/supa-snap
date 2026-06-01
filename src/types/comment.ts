export interface CommentReaction {
  id: string;
  username: string;
  emoji: string;
}

export interface Comment {
  id: string;
  photo_id: string;
  user_id?: string | null;
  username: string;
  body: string;
  created_at: string;
  reactions?: CommentReaction[];
}
