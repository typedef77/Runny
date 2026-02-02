import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersApi, communityApi, goalsApi } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { format, parseISO } from 'date-fns';
import './Profile.css';

interface ProfileData {
  id: number;
  name: string;
  photo: string | null;
  isPublic: boolean;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  recentRuns: {
    id: number;
    date: string;
    duration_minutes: number;
    effort_level: number;
    title: string;
    workout_type: string;
  }[];
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user, updateUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Goal info for own profile
  const [goal, setGoal] = useState<any>(null);

  const profileId = id ? parseInt(id) : user?.id;

  useEffect(() => {
    if (profileId) {
      loadProfile();
    }
  }, [profileId]);

  const loadProfile = async () => {
    try {
      const response = await usersApi.getProfile(profileId!);
      setProfile(response.data);
      setEditName(response.data.name);
      setEditIsPublic(response.data.isPublic);

      // Load goal if own profile
      if (response.data.isOwnProfile) {
        try {
          const goalResponse = await goalsApi.getActive();
          setGoal(goalResponse.data.goal);
        } catch (err) {
          // No active goal
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('This profile is private');
      } else {
        setError('Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      await communityApi.follow(profileId!);
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: true,
        followerCount: prev.followerCount + 1
      } : null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to follow');
    }
  };

  const handleUnfollow = async () => {
    try {
      await communityApi.unfollow(profileId!);
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: false,
        followerCount: prev.followerCount - 1
      } : null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unfollow');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await usersApi.updateProfile({
        name: editName,
        isPublic: editIsPublic,
      });
      updateUser({ name: editName, isPublic: editIsPublic });
      setProfile(prev => prev ? {
        ...prev,
        name: editName,
        isPublic: editIsPublic,
      } : null);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await usersApi.uploadPhoto(file);
      const newPhoto = response.data.photo;
      updateUser({ photo: newPhoto });
      setProfile(prev => prev ? { ...prev, photo: newPhoto } : null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload photo');
    }
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="container">
        <div className="card text-center">
          <p className="text-light">{error}</p>
          <Link to="/community" className="btn btn-primary mt-2">
            Back to Community
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container">
        <div className="card text-center">
          <p className="text-light">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container profile-page">
      {error && <div className="error-message">{error}</div>}

      <div className="profile-header card">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            {profile.photo ? (
              <img src={profile.photo} alt={profile.name} />
            ) : (
              <span>{profile.name.charAt(0)}</span>
            )}
          </div>
          {profile.isOwnProfile && (
            <label className="photo-upload-btn">
              Change Photo
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                hidden
              />
            </label>
          )}
        </div>

        <div className="profile-info">
          {editing ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="editName">Name</label>
                <input
                  type="text"
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                  />
                  Public profile (visible to others)
                </label>
              </div>
              <div className="edit-actions">
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1>{profile.name}</h1>
              <div className="profile-stats">
                <span>{profile.followerCount} followers</span>
                <span>{profile.followingCount} following</span>
              </div>
              {!profile.isPublic && (
                <span className="private-badge">Private Profile</span>
              )}
            </>
          )}
        </div>

        <div className="profile-actions">
          {profile.isOwnProfile ? (
            <>
              {!editing && (
                <button
                  className="btn btn-outline"
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
              )}
              <button className="btn btn-outline" onClick={logout}>
                Log Out
              </button>
            </>
          ) : (
            <button
              className={`btn ${profile.isFollowing ? 'btn-outline' : 'btn-primary'}`}
              onClick={profile.isFollowing ? handleUnfollow : handleFollow}
            >
              {profile.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {profile.isOwnProfile && goal && (
        <div className="goal-section card">
          <h3>Current Goal</h3>
          <div className="goal-info">
            <div className="goal-stat">
              <span className="goal-value">{goal.raceDistance.toUpperCase()}</span>
              <span className="goal-label">Race</span>
            </div>
            <div className="goal-stat">
              <span className="goal-value">
                {format(parseISO(goal.raceDate), 'MMM d')}
              </span>
              <span className="goal-label">Race Date</span>
            </div>
            <div className="goal-stat">
              <span className="goal-value">{goal.experienceLevel}</span>
              <span className="goal-label">Level</span>
            </div>
          </div>
          <Link to="/create-goal" className="btn btn-outline btn-small mt-2">
            Change Goal
          </Link>
        </div>
      )}

      {profile.recentRuns.length > 0 && (
        <div className="recent-runs card">
          <h3>Recent Runs</h3>
          <div className="runs-list">
            {profile.recentRuns.map(run => (
              <div key={run.id} className="run-item">
                <span className="run-date">
                  {format(parseISO(run.date), 'MMM d')}
                </span>
                <span className="run-title">{run.title || 'Run'}</span>
                <span className="run-duration">{run.duration_minutes} min</span>
                {run.workout_type && (
                  <span className={`workout-type workout-${run.workout_type}`}>
                    {run.workout_type}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
