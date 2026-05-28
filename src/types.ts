export type SeniorityLevel = "junior" | "mid" | "senior";

export interface Requirement {
  name: string;
  description?: string;
}

export interface Position {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  seniority: SeniorityLevel;
  requirements: Requirement[];
  team: string | null;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  position_id: string;
  file_name: string;
  file_path: string;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateScore {
  candidate_id: string;
  scores: { requirement: string; score: number; comment: string }[];
  overall_fit: number;
}

export interface Ranking {
  best_match: string | null;
  option_b: string | null;
  reasoning: string;
}

export interface InterviewQuestion {
  question: string;
  category: string;
  rationale: string;
}

export interface Evaluation {
  id: string;
  position_id: string;
  candidate_scores: CandidateScore[];
  ranking: Ranking | null;
  all_rejected: boolean;
  questions: InterviewQuestion[];
  created_at: string;
  updated_at: string;
}
