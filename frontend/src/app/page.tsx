/**
 * Root route "/".
 * app/(landing)/layout.tsx only wraps pages *inside* the route group.
 * Since app/page.tsx is outside the group, we explicitly wrap with LandingLayout
 * so the Navbar and Footer appear on the home page too.
 */
import LandingLayout from './(landing)/layout';
import HomePage from './(landing)/page';

export default function RootPage() {
  return (
    <LandingLayout>
      <HomePage />
    </LandingLayout>
  );
}
