
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agent_runs": {
                  Row: {
                    "agent": string,"error": string | null,"finished_at": string | null,"id": string,"input": Json | null,"institution_id": string,"output": Json | null,"started_at": string,"status": string,"tools_called": (string)[],"trigger": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agent": string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: Json | null,"institution_id": string,"output"?: Json | null,"started_at"?: string,"status"?: string,"tools_called"?: (string)[],"trigger": string,"user_id"?: string | null
                  }
                  Update: {
                    "agent"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: Json | null,"institution_id"?: string,"output"?: Json | null,"started_at"?: string,"status"?: string,"tools_called"?: (string)[],"trigger"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_runs_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_runs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "approval_id": string | null,"author_id": string,"body": string,"course_id": string | null,"id": string,"institution_id": string,"published_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_id"?: string | null,"author_id": string,"body": string,"course_id"?: string | null,"id"?: string,"institution_id": string,"published_at"?: string,"title": string
                  }
                  Update: {
                    "approval_id"?: string | null,"author_id"?: string,"body"?: string,"course_id"?: string | null,"id"?: string,"institution_id"?: string,"published_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_approval_id_fkey"
      columns: ["approval_id"]
isOneToOne: false
      referencedRelation: "approvals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"approvals": {
                  Row: {
                    "agent_run_id": string | null,"course_id": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"institution_id": string,"kind": string,"payload": NonNullable<Json>,"reviewer_role": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_run_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"institution_id": string,"kind": string,"payload": NonNullable<Json>,"reviewer_role": string,"status"?: string
                  }
                  Update: {
                    "agent_run_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"institution_id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"reviewer_role"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_agent_run_id_fkey"
      columns: ["agent_run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "course_id": string,"created_at": string,"created_by": string,"due_at": string,"id": string,"institution_id": string,"instructions": string,"rubric": NonNullable<Json>,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"created_by": string,"due_at": string,"id"?: string,"institution_id": string,"instructions": string,"rubric"?: NonNullable<Json>,"title": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"created_by"?: string,"due_at"?: string,"id"?: string,"institution_id"?: string,"instructions"?: string,"rubric"?: NonNullable<Json>,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"institution_id": string,"name": string,"professor_id": string,"term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"institution_id": string,"name": string,"professor_id": string,"term": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"institution_id"?: string,"name"?: string,"professor_id"?: string,"term"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courses_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"document_chunks": {
                  Row: {
                    "content": string,"course_id": string | null,"document_id": string,"embedding": string,"id": number,"institution_id": string,"page": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"course_id"?: string | null,"document_id": string,"embedding": string,"id"?: never,"institution_id": string,"page": number
                  }
                  Update: {
                    "content"?: string,"course_id"?: string | null,"document_id"?: string,"embedding"?: string,"id"?: never,"institution_id"?: string,"page"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_chunks_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_chunks_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_chunks_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "course_id": string | null,"created_at": string,"error": string | null,"file_path": string,"id": string,"institution_id": string,"page_count": number | null,"status": string,"summary": string | null,"summary_status": string,"title": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"error"?: string | null,"file_path": string,"id"?: string,"institution_id": string,"page_count"?: number | null,"status"?: string,"summary"?: string | null,"summary_status"?: string,"title": string,"uploaded_by": string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"error"?: string | null,"file_path"?: string,"id"?: string,"institution_id"?: string,"page_count"?: number | null,"status"?: string,"summary"?: string | null,"summary_status"?: string,"title"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "course_id": string,"created_at": string,"id": string,"institution_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"id"?: string,"institution_id": string,"student_id": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"id"?: string,"institution_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_records": {
                  Row: {
                    "amount_due": number,"amount_paid": number,"created_at": string,"description": string,"due_date": string,"id": string,"institution_id": string,"status": string | null,"student_id": string,"term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due": number,"amount_paid"?: number,"created_at"?: string,"description": string,"due_date": string,"id"?: string,"institution_id": string,"status"?: never,"student_id": string,"term": string
                  }
                  Update: {
                    "amount_due"?: number,"amount_paid"?: number,"created_at"?: string,"description"?: string,"due_date"?: string,"id"?: string,"institution_id"?: string,"status"?: never,"student_id"?: string,"term"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_records_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_records_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"institutions": {
                  Row: {
                    "created_at": string,"currency": string,"current_term": string,"grading_scale": string,"id": string,"name": string,"slug": string,"term_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": string,"current_term": string,"grading_scale": string,"id"?: string,"name": string,"slug": string,"term_type": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"current_term"?: string,"grading_scale"?: string,"id"?: string,"name"?: string,"slug"?: string,"term_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "agent_run_id": string | null,"body": string | null,"created_at": string,"id": string,"institution_id": string,"kind": string,"link": string | null,"read_at": string | null,"ref": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_run_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"institution_id": string,"kind": string,"link"?: string | null,"read_at"?: string | null,"ref"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "agent_run_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"institution_id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"ref"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_agent_run_id_fkey"
      columns: ["agent_run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"currency": string,"fee_record_id": string,"id": string,"institution_id": string,"paid_at": string,"receipt_url": string | null,"stripe_session_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"currency": string,"fee_record_id": string,"id"?: string,"institution_id": string,"paid_at"?: string,"receipt_url"?: string | null,"stripe_session_id": string,"student_id": string
                  }
                  Update: {
                    "amount"?: number,"currency"?: string,"fee_record_id"?: string,"id"?: string,"institution_id"?: string,"paid_at"?: string,"receipt_url"?: string | null,"stripe_session_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_fee_record_id_fkey"
      columns: ["fee_record_id"]
isOneToOne: false
      referencedRelation: "fee_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"professor_ratings": {
                  Row: {
                    "comment": string | null,"course_id": string,"created_at": string,"id": string,"institution_id": string,"professor_id": string,"rating": number,"student_id": string,"term": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"institution_id": string,"professor_id": string,"rating": number,"student_id": string,"term": string,"updated_at"?: string
                  }
                  Update: {
                    "comment"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"institution_id"?: string,"professor_id"?: string,"rating"?: number,"student_id"?: string,"term"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "professor_ratings_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "professor_ratings_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "professor_ratings_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "professor_ratings_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"institution_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name": string,"id": string,"institution_id": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"institution_id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    }
                  ]
                },"rating_summaries": {
                  Row: {
                    "course_id": string,"institution_id": string,"professor_id": string,"themes": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"institution_id": string,"professor_id": string,"themes": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"institution_id"?: string,"professor_id"?: string,"themes"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rating_summaries_course_id_fkey"
      columns: ["course_id"]
isOneToOne: true
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rating_summaries_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rating_summaries_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"submissions": {
                  Row: {
                    "assignment_id": string,"feedback": string | null,"feedback_released_at": string | null,"file_name": string,"file_path": string,"id": string,"institution_id": string,"is_late": boolean,"precheck": Json | null,"precheck_status": string,"student_id": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"feedback"?: string | null,"feedback_released_at"?: string | null,"file_name": string,"file_path": string,"id"?: string,"institution_id": string,"is_late"?: boolean,"precheck"?: Json | null,"precheck_status"?: string,"student_id": string,"submitted_at"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"feedback"?: string | null,"feedback_released_at"?: string | null,"file_name"?: string,"file_path"?: string,"id"?: string,"institution_id"?: string,"is_late"?: boolean,"precheck"?: Json | null,"precheck_status"?: string,"student_id"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_institution_id_fkey"
      columns: ["institution_id"]
isOneToOne: false
      referencedRelation: "institutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submissions_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "rating_aggregates": {
                  Row: {
                    "average": number | null,"count": number | null,"course_id": string | null,"professor_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "professor_ratings_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "professor_ratings_professor_id_fkey"
      columns: ["professor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "can_see_course":
{ Args: { "course": string }; Returns: boolean
                           },
"is_enrolled":
{ Args: { "course": string }; Returns: boolean
                           },
"match_chunks":
{ Args: { "match_count"?: number,"query_embedding": string }; Returns: {
              "content": string,"document_id": string,"page": number,"similarity": number,"title": string
            }[]
                           },
"my_institution":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"record_payment":
{ Args: { "p_amount": number,"p_currency": string,"p_fee_record_id": string,"p_receipt_url": string,"p_session_id": string }; Returns: boolean
                           },
"teaches":
{ Args: { "course": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
