import { useAppStore } from '../../store/appStore';

export const TopBar = () => {
  const { user, signOut } = useAppStore((state) => ({
    user: state.user,
    signOut: state.signOut
  }));

  return (
    <header className="top-bar">
      <div className="top-bar__content">
        <div>
          <h2 className="top-bar__title">{user?.organisation ?? 'APGMS'}</h2>
          {user && <p className="top-bar__subtitle">{user.email}</p>}
        </div>
        {user && (
          <button className="button button--ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
};
