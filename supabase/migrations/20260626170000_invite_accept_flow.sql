-- Update handle_new_user to process pending invitations.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_school_id UUID;
    pending_invite RECORD;
BEGIN
    -- Check if there is a pending invitation for this email
    SELECT id, school_id, role
    INTO pending_invite
    FROM invitations
    WHERE email = LOWER(NEW.email)
      AND status = 'pending'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF pending_invite.id IS NOT NULL THEN
        -- Link user to the invited school
        INSERT INTO school_members (school_id, user_id, role)
        VALUES (pending_invite.school_id, NEW.id, pending_invite.role);

        -- Mark the invitation as accepted
        UPDATE invitations
        SET status = 'accepted',
            revoked_at = NOW()
        WHERE id = pending_invite.id;
    ELSE
        -- No pending invitation: Create a brand new school and add as admin
        INSERT INTO schools (name, plan)
        VALUES (COALESCE(NEW.raw_user_meta_data->>'school_name', NEW.email), 'starter')
        RETURNING id INTO new_school_id;

        INSERT INTO school_members (school_id, user_id, role)
        VALUES (new_school_id, NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
