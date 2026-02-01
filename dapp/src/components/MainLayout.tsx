interface MainLayoutProps {
  actionArea: React.ReactNode
  historyArea: React.ReactNode
  agentArea: React.ReactNode
}

export function MainLayout({ actionArea, historyArea, agentArea }: MainLayoutProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left column - Actions and History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Action Area */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            {actionArea}
          </div>

          {/* History Area */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            {historyArea}
          </div>
        </div>

        {/* Right column - AI Agent */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 h-[calc(100vh-120px)] flex flex-col">
              {agentArea}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
