-- Store the uploaded file's MIME type so the worker can serve media with the
-- right Content-Type when streaming it back from R2.
ALTER TABLE media ADD COLUMN content_type TEXT;
