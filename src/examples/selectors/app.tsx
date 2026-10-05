import { Editor, LikeCount, ProfileName, TagList } from './view'

export default function App() {
    return (
        <>
            <ProfileName userId="ada" />
            <Editor userId="ada" />
            <LikeCount userId="ada" />
            <TagList userId="ada" />
        </>
    )
}
