export const PlaygroundHeader = () => {
    return (
        <header className="playground-header">
            <h1 className="playground-title">React State Custom</h1>
            <p className="playground-subtitle">
                A hook-first state management library for React 19
            </p>

            <div className="playground-links">
                <a
                    href="https://github.com/vothanhdat/react-state-custom"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="playground-link"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    GitHub
                </a>
                <a
                    href="https://www.npmjs.com/package/react-state-custom"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="playground-link"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M0 0v16h16V0H0zm13 13H8v-2H5v2H3V3h10v10z" />
                    </svg>
                    NPM Package
                </a>
                <a
                    href="https://github.com/vothanhdat/react-state-custom/blob/master/API_DOCUMENTATION.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="playground-link"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3.797a1.5 1.5 0 0 1 1.06.44l.707.707A.5.5 0 0 0 8.418 2.5H14.5A1.5 1.5 0 0 1 16 4v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11V4a1.5 1.5 0 0 1 1-1.41V2.5zm1 .5v8.5h12V4H2z" />
                    </svg>
                    Documentation
                </a>
            </div>
        </header>
    )
}
