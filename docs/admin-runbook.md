# A Thousand Units admin runbook

Run these in the Supabase SQL Editor. Replace the placeholder values.

## Verify an artist
update public.profiles set role = 'artist', verified_artist = true where id = 'USER-ID';

## Feature a maker on the homepage (1 shows first) or remove the feature
update public.profiles set featured_order = 1 where id = 'USER-ID';
update public.profiles set featured_order = null where id = 'USER-ID';

## Hide someone from Meet the Makers
update public.profiles set hidden_from_makers = true where id = 'USER-ID';

## Open or close a category
update public.categories set enabled = true where slug = 'music_producer';
update public.categories set enabled = false where slug = 'music_dj';

## Review open copyright reports
select r.id, r.created_at, r.reporter_name, r.reporter_email, r.relationship, r.work_description, p.title, p.creator_id
from public.takedown_reports r join public.products p on p.id = r.product_id
where r.status = 'open' order by r.created_at;

## Take a release down (hides it, blocks downloads, adds a strike, 3 strikes suspend the artist)
select public.takedown_product('PRODUCT-ID', 'Short reason');

## Restore a release after a successful counter notice (removes one strike)
select public.restore_product('PRODUCT-ID', 'Short note');

## Check an artist's standing
select * from public.creator_compliance where profile_id = 'USER-ID';

## Lift a suspension by hand
update public.creator_compliance set suspended_at = null, strikes = 0 where profile_id = 'USER-ID';

Notes
- Reports arrive silently. Check the open reports query every day until email alerts are added.
- Removed releases stay in the database. Buyers lose access to the files while a release is removed.
- Delete audio files from Storage only when a release has been removed for good.

## Make an account an artist (the Creator studio only appears for artist accounts)
update public.profiles set role = 'artist', verified_artist = true
where id = (select id from auth.users where email = 'person@example.com');

## Check what role an account has
select p.id, u.email, p.role, p.verified_artist
from public.profiles p join auth.users u on u.id = p.id
where u.email = 'person@example.com';

## Preview clips
- Previews are short clips that anyone can play on a release page. They are stored privately and served through short-lived links.
- Taking a release down (takedown_product) stops its previews straight away.
- To see a release's previews: select title, size_bytes, status from public.product_previews where product_id = 'PRODUCT-ID';
