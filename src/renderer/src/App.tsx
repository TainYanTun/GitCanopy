import React, { useState, useEffect } from "react";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import { Repository } from "../../shared/types";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MainLayout } from "./components/MainLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useToast } from "./components/ToastContext";
import { AuthModal } from "./components/AuthModal";
import { useTheme } from "./components/ThemeContext";
import { WhatsNewModal } from "./components/WhatsNewModal";

interface AppState {
  repository: Repository | null;
  loading: boolean;
  error: string | null;
}

const App: React.FC = () => {
  const { showToast } = useToast();
  const { theme } = useTheme();
  
  const [state, setState] = useState<AppState>({
    repository: null,
    loading: false,
    error: null,
  });
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    if (!window.gitcanopyAPI) return;

    const checkVersion = async () => {
      try {
        const settings = await window.gitcanopyAPI.getSettings();
        const version = await window.gitcanopyAPI.getAppVersion();
        setCurrentVersion(version);

        if (settings.lastSeenVersion !== version) {
          setShowWhatsNew(true);
        }
      } catch (e) {
        console.error("Failed to check version:", e);
      }
    };

    checkVersion();

    const unsubscribe = window.gitcanopyAPI.onAuthRequest(({ prompt }) => {
      setAuthPrompt(prompt);
    });

    const unsubscribeMenu = window.gitcanopyAPI.onMenuOpenRepository(() => {
      handleSelectRepository();
    });

    return () => {
      unsubscribe();
      unsubscribeMenu();
    };
  }, []);

  const handleAuthSubmit = async (answer: string) => {
    await window.gitcanopyAPI.submitAuth(answer);
    setAuthPrompt(null);
  };

  const handleAuthCancel = async () => {
    await window.gitcanopyAPI.cancelAuth();
    setAuthPrompt(null);
  };

  const handleCloseWhatsNew = async () => {
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      await window.gitcanopyAPI.saveSettings({
        ...settings,
        lastSeenVersion: currentVersion
      });
      setShowWhatsNew(false);
    } catch (e) {
      console.error(e);
      setShowWhatsNew(false);
    }
  };

  // Handle repository selection
  const handleSelectRepository = async (repoPath?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      let repository: Repository | null;

      if (repoPath) {
        // If a path is provided (e.g., from recent repos), use it directly
        repository = await window.gitcanopyAPI.getRepository(repoPath);
      } else {
        // Otherwise, open the file dialog
        repository = await window.gitcanopyAPI.selectRepository();
      }

      if (repository) {
        setState({
          repository,
          loading: false,
          error: null,
        });

        // Start watching the repository for changes
        await window.gitcanopyAPI.watchRepository(repository.path);
        showToast(`Repository loaded: ${repository.name}`, "success");
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Failed to select repository:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load repository";
      showToast(errorMessage, "error");

      setState({
        repository: null,
        loading: false,
        error: errorMessage,
      });
    }
  };

  // Handle repository close
  const handleCloseRepository = async () => {
    if (state.repository) {
      try {
        await window.gitcanopyAPI.unwatchRepository(state.repository.path);
      } catch (error) {
        console.error("Failed to unwatch repository:", error);
      }
    }

    setState({
      repository: null,
      loading: false,
      error: null,
    });
    showToast("Repository closed", "info");
  };

  const refreshRepository = async () => {
    if (state.repository) {
      try {
        const updatedRepo = await window.gitcanopyAPI.getRepository(
          state.repository.path,
        );
        setState((prev) => ({
          ...prev,
          repository: updatedRepo,
        }));
      } catch (error) {
        console.error("Failed to refresh repository:", error);
      }
    }
  };

  // Check for initial repository from CLI
  useEffect(() => {
    const checkInitialRepo = async () => {
      try {
        if (
          window.gitcanopyAPI &&
          typeof window.gitcanopyAPI.getInitialRepo === "function"
        ) {
          const initialPath = await window.gitcanopyAPI.getInitialRepo();
          if (initialPath) {
            handleSelectRepository(initialPath);
          }
        }
      } catch (error) {
        console.error("Failed to check for initial repo:", error);
      }
    };

    checkInitialRepo();
  }, []);

  // Set up event listeners for repository changes
  useEffect(() => {
    const handleRepositoryChanged = async (_event: any) => {
      if (state.repository) {
        try {
          const updatedRepo = await window.gitcanopyAPI.getRepository(
            state.repository.path,
          );
          setState((prev) => ({
            ...prev,
            repository: updatedRepo,
          }));
        } catch (error) {
          console.error("Failed to refresh repository on change:", error);
        }
      }
    };

    const handleHeadChanged = async (_event: any) => {
      if (state.repository) {
        try {
          const updatedRepo = await window.gitcanopyAPI.getRepository(
            state.repository.path,
          );
          setState((prev) => ({
            ...prev,
            repository: updatedRepo,
          }));
        } catch (error) {
          console.error("Failed to refresh repository on HEAD change:", error);
        }
      }
    };

    // Set up event listeners
    let unsubscribeRepo: (() => void) | undefined;
    let unsubscribeHead: (() => void) | undefined;

    if (window.gitcanopyAPI) {
      unsubscribeRepo = window.gitcanopyAPI.onRepositoryChanged(
        handleRepositoryChanged,
      );
      unsubscribeHead = window.gitcanopyAPI.onHeadChanged(handleHeadChanged);
    }

    return () => {
      unsubscribeRepo?.();
      unsubscribeHead?.();
    };
  }, [state.repository]);

  // Error handling
  const handleErrorDismiss = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // Show loading screen
  if (state.loading) {
    return <LoadingScreen message="Loading repository..." />;
  }

  // Show error if there's an error
  if (state.error) {
    return (
      <div className="h-full flex items-center justify-center bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-zed-dark-text">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Repository
            </h3>
            <p className="text-gray-600 mb-4">{state.error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleErrorDismiss} className="btn-secondary">
                Dismiss
              </button>
              <button
                onClick={() => handleSelectRepository()}
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <AntdApp style={{ height: '100%' }}>
        <ErrorBoundary>
          <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-zed-dark-text relative overflow-hidden">
            <WhatsNewModal 
              visible={showWhatsNew} 
              onClose={handleCloseWhatsNew} 
              version={currentVersion} 
            />
            {authPrompt && (
              <AuthModal
                prompt={authPrompt}
                onSubmit={handleAuthSubmit}
                onCancel={handleAuthCancel}
              />
            )}
            {state.repository ? (
              <MainLayout
                repository={state.repository}
                onCloseRepository={handleCloseRepository}
                onRefreshRepository={refreshRepository}
              />
            ) : (
              <WelcomeScreen onSelectRepository={handleSelectRepository} />
            )}
          </div>
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
