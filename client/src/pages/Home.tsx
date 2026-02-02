import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <h1>Train Smarter, Run Stronger</h1>
          <p className="hero-subtitle">
            Runny creates personalized training plans that adapt to your schedule
            and help you reach your race goals safely.
          </p>
          <div className="hero-cta">
            <Link to="/signup" className="btn btn-primary">
              Start Training Free
            </Link>
            <Link to="/login" className="btn btn-outline">
              Log In
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="text-center mb-4">How Runny Works</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">1</div>
              <h3>Set Your Goal</h3>
              <p>
                Tell us your race distance, date, and when you can run.
                We'll build a plan just for you.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">2</div>
              <h3>Follow Your Plan</h3>
              <p>
                See your workouts for the week. Each one tells you exactly
                what to do and how hard to push.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">3</div>
              <h3>Log Your Runs</h3>
              <p>
                Quick logging after each run. Tell us how it felt and we'll
                adjust your training automatically.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">4</div>
              <h3>Adapt & Improve</h3>
              <p>
                Life happens. Change your schedule anytime and your plan
                updates to keep you on track.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="race-types">
        <div className="container">
          <h2 className="text-center mb-4">Train for Any Distance</h2>
          <div className="race-grid">
            <div className="race-card">
              <span className="race-distance">5K</span>
              <span className="race-label">Perfect for beginners</span>
            </div>
            <div className="race-card">
              <span className="race-distance">10K</span>
              <span className="race-label">Build your endurance</span>
            </div>
            <div className="race-card">
              <span className="race-distance">Half Marathon</span>
              <span className="race-label">Challenge yourself</span>
            </div>
            <div className="race-card">
              <span className="race-distance">Marathon</span>
              <span className="race-label">Go the distance</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container text-center">
          <h2>Ready to Start Training?</h2>
          <p className="text-light mb-3">
            Join Runny today and get a personalized training plan in minutes.
          </p>
          <Link to="/signup" className="btn btn-primary">
            Create Your Free Account
          </Link>
        </div>
      </section>
    </div>
  );
}
