import Background from './Background'
import CameraRig from './CameraRig'
import Lighting from './Lighting'
import PostFX from './PostFX'
import RoomShell from './RoomShell'

export default function Experience() {
  return (
    <>
      <Background />
      <Lighting />
      <RoomShell />
      <CameraRig />
      <PostFX />
    </>
  )
}
