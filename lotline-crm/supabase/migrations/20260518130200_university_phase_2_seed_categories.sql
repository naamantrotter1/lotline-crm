-- Forum category seed. Idempotent on slug.
INSERT INTO public.university_forum_categories (slug, name, description, sort_order) VALUES
  ('general',       'General Discussion', 'Open chat about the LotLine playbook, mindset, and anything else.', 0),
  ('wins',          'Wins',               'Share deals you closed, milestones you hit, and lessons learned.',     1),
  ('accountability','Accountability',     'Public commitments and weekly check-ins to keep yourself on track.',   2),
  ('deal-reviews',  'Deal Reviews',       'Post a deal you''re analyzing; the community + LotLine tear it apart.', 3),
  ('deal-funders',  'Deal Funders',       'Connect operators with capital partners. LotLine-moderated.',          4)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order;
