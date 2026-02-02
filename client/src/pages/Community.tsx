import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { communityApi, usersApi } from '../api/client';
import { format, parseISO } from 'date-fns';
import './Community.css';

interface FeedItem {
  id: number;
  date: string;
  durationMinutes: number;
  effortLevel: number;
  user: {
    id: number;
    name: string;
    photo: string | null;
  };
  workout: {
    title: string;
    type: string;
    isLongRun: boolean;
  } | null;
}

interface WeeklySummary {
  user: {
    id: number;
    name: string;
    photo: string | null;
  };
  runCount: number;
  totalMinutes: number;
  longestRun: number;
}

interface DiscoverUser {
  id: number;
  name: string;
  photo: string | null;
  recentRunCount: number;
  recentMinutes: number;
}

export default function Community() {
  const [activeTab, setActiveTab] = useState<'feed' | 'discover' | 'following'>('feed');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([]);
  const [following, setFollowing] = useState<{ id: number; name: string; photo: string | null }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [feedRes, summariesRes, discoverRes, followingRes] = await Promise.all([
        communityApi.getFeed(),
        communityApi.getWeeklySummaries(),
        communityApi.discover(),
        communityApi.getFollowing(),
      ]);

      setFeed(feedRes.data.feed);
      setWeeklySummaries(summariesRes.data.summaries);
      setDiscoverUsers(discoverRes.data.users);
      setFollowing(followingRes.data.following);
    } catch (err) {
      setError('Failed to load community data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    try {
      const response = await usersApi.searchUsers(searchQuery);
      setSearchResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await communityApi.follow(userId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to follow user');
    }
  };

  const handleUnfollow = async (userId: number) => {
    try {
      await communityApi.unfollow(userId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unfollow user');
    }
  };

  const isFollowing = (userId: number) => following.some(f => f.id === userId);

  if (loading) {
    return (
      <div className="container loading-container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="container community-page">
      {error && <div className="error-message">{error}</div>}

      <h1>Community</h1>
      <p className="text-light mb-3">See what others are doing and find running buddies</p>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Activity Feed
        </button>
        <button
          className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
        <button
          className={`tab ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => setActiveTab('following')}
        >
          Following ({following.length})
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="feed-section">
          {weeklySummaries.length > 0 && (
            <div className="weekly-summaries card">
              <h3>This Week's Leaders</h3>
              <div className="summaries-list">
                {weeklySummaries.slice(0, 5).map(summary => (
                  <Link
                    key={summary.user.id}
                    to={`/profile/${summary.user.id}`}
                    className="summary-item"
                  >
                    <div className="user-avatar">
                      {summary.user.photo ? (
                        <img src={summary.user.photo} alt={summary.user.name} />
                      ) : (
                        <span>{summary.user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="summary-info">
                      <span className="summary-name">{summary.user.name}</span>
                      <span className="summary-stats">
                        {summary.runCount} runs · {summary.totalMinutes} min
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <h3 className="mt-3">Recent Activity</h3>
          {feed.length === 0 ? (
            <div className="card text-center">
              <p className="text-light">
                No activity yet. Follow some runners to see their updates!
              </p>
            </div>
          ) : (
            <div className="feed-list">
              {feed.map(item => (
                <div key={item.id} className="feed-item card">
                  <Link to={`/profile/${item.user.id}`} className="feed-user">
                    <div className="user-avatar">
                      {item.user.photo ? (
                        <img src={item.user.photo} alt={item.user.name} />
                      ) : (
                        <span>{item.user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <span className="feed-user-name">{item.user.name}</span>
                      <span className="feed-date">
                        {format(parseISO(item.date), 'MMM d')}
                      </span>
                    </div>
                  </Link>
                  <div className="feed-content">
                    <p className="feed-workout">
                      {item.workout ? item.workout.title : 'Completed a run'}
                      {item.workout?.isLongRun && (
                        <span className="workout-type workout-long">Long Run</span>
                      )}
                    </p>
                    <div className="feed-stats">
                      <span>{item.durationMinutes} min</span>
                      <span>Effort: {item.effortLevel}/10</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="discover-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search runners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary btn-small" onClick={handleSearch}>
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Search Results</h3>
              <div className="users-list">
                {searchResults.map(user => (
                  <div key={user.id} className="user-card card">
                    <Link to={`/profile/${user.id}`} className="user-info">
                      <div className="user-avatar">
                        {user.photo ? (
                          <img src={user.photo} alt={user.name} />
                        ) : (
                          <span>{user.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="user-name">{user.name}</span>
                    </Link>
                    <button
                      className={`btn btn-small ${isFollowing(user.id) ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => isFollowing(user.id) ? handleUnfollow(user.id) : handleFollow(user.id)}
                    >
                      {isFollowing(user.id) ? 'Unfollow' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>Active Runners</h3>
          {discoverUsers.length === 0 ? (
            <div className="card text-center">
              <p className="text-light">No active runners to discover right now.</p>
            </div>
          ) : (
            <div className="users-list">
              {discoverUsers.map(user => (
                <div key={user.id} className="user-card card">
                  <Link to={`/profile/${user.id}`} className="user-info">
                    <div className="user-avatar">
                      {user.photo ? (
                        <img src={user.photo} alt={user.name} />
                      ) : (
                        <span>{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <span className="user-name">{user.name}</span>
                      <span className="user-stats">
                        {user.recentRunCount} runs this month
                      </span>
                    </div>
                  </Link>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => handleFollow(user.id)}
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'following' && (
        <div className="following-section">
          {following.length === 0 ? (
            <div className="card text-center">
              <p className="text-light">You're not following anyone yet.</p>
              <button
                className="btn btn-primary mt-2"
                onClick={() => setActiveTab('discover')}
              >
                Find Runners
              </button>
            </div>
          ) : (
            <div className="users-list">
              {following.map(user => (
                <div key={user.id} className="user-card card">
                  <Link to={`/profile/${user.id}`} className="user-info">
                    <div className="user-avatar">
                      {user.photo ? (
                        <img src={user.photo} alt={user.name} />
                      ) : (
                        <span>{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="user-name">{user.name}</span>
                  </Link>
                  <button
                    className="btn btn-outline btn-small"
                    onClick={() => handleUnfollow(user.id)}
                  >
                    Unfollow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
