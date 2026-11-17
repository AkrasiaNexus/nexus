-- New role: manages one community (members, campaigns, collection points). Separate file: a new enum
-- value must be committed before other statements can use it.
alter type "Role" add value if not exists 'COMMUNITY_ADMIN';
