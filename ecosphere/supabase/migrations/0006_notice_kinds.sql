-- New notification categories (enum values must be committed before use).
alter type "NoticeKind" add value if not exists 'MARKETPLACE';
alter type "NoticeKind" add value if not exists 'REWARD';
