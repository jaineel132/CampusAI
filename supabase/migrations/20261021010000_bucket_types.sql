-- Storage enforces file type and size itself, even for direct browser uploads.
update storage.buckets set allowed_mime_types = array['application/pdf', 'text/plain'], file_size_limit = 10485760
where id in ('materials', 'submissions');
