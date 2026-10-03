import { Suspense } from 'react'
import { Editor, LikeCount, ProfileName, TagList } from './view'

export default function App() {
    return (
        <>
            <Suspense fallback={<div className="card">Loading profile…</div>}>
                <ProfileName userId="ada" />
            </Suspense>
            <Editor userId="ada" />
            <LikeCount userId="ada" />
            <TagList userId="ada" />
        </>
    )
}
