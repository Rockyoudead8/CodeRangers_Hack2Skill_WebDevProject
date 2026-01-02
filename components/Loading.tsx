import React from 'react'

const Loading = () => {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="flex flex-col items-center gap-3">

                <div className="w-16 h-16 bg-blue-600 rounded-full animate-ping"></div>

                <h2 className="text-white text-lg font-semibold">
                    Loading CollabBoard
                </h2>

                <p className="text-gray-400 text-sm">
                    Connecting you back to the workspace…
                </p>

            </div>
        </div>
    )
}

export default Loading