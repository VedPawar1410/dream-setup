import Background from './Background'
import Blueprint from './Blueprint'
import CameraRig from './CameraRig'
import Lighting from './Lighting'
import PostFX from './PostFX'
import RoomShell from './RoomShell'
import Weather from './Weather'

export default function Experience() {
  return (
    <>
      <Background />
      <Lighting />
      <RoomShell />
      <Weather />
      <Blueprint />
      <CameraRig />
      <PostFX />
    </>
  )
}
