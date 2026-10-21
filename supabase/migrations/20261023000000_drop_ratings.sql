-- Professor ratings and the Feedback agent were removed from the MVP by choice.
drop view if exists public.rating_aggregates;
drop table if exists public.rating_summaries;
drop table if exists public.professor_ratings;
