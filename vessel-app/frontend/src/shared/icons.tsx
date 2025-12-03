import React from "react"

type BaseIconProps = React.SVGProps<SVGSVGElement> & {
  title?: string
}

type VolumeIconProps = BaseIconProps & {
  muted?: boolean
}

const SvgIcon = ({ title, children, ...rest }: BaseIconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden={title ? undefined : true}
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
)

export const VolumeIcon = ({ muted, ...rest }: VolumeIconProps) =>
  muted ? (
    <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </SvgIcon>
  ) : (
    <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19 5a8 8 0 0 1 0 14" />
      <path d="M15 9a4 4 0 0 1 0 6" />
    </SvgIcon>
  )

export const HeartIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.8 4.6c-1.7-1.6-4.3-1.6-6 0L12 7.3 9.2 4.6c-1.7-1.6-4.3-1.6-6 0-1.9 1.7-1.9 4.6 0 6.3L12 19l8.8-8.1c1.9-1.7 1.9-4.6 0-6.3z" />
  </SvgIcon>
)

// Filled like icon - uses currentColor for fill so it can be colored via CSS
export const LikeIconFilled = (props: BaseIconProps) => (
  <SvgIcon stroke="none" fill="currentColor" {...props}>
    <path d="M20.8 4.6c-1.7-1.6-4.3-1.6-6 0L12 7.3 9.2 4.6c-1.7-1.6-4.3-1.6-6 0-1.9 1.7-1.9 4.6 0 6.3L12 19l8.8-8.1c1.9-1.7 1.9-4.6 0-6.3z" />
  </SvgIcon>
)

// Inline version of the original provided like SVG (from public/media/icons/icons8-like.svg)
// Uses `currentColor` so it can be recoloured via CSS (e.g., pink when liked)
export const ProvidedLikeIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="none" fill="currentColor" viewBox="0 0 50 50" {...props}>
    <path d="M 25 47 L 24.359375 46.472656 C 23.144531 45.464844 21.5 44.371094 19.59375 43.105469 C 12.167969 38.171875 2 31.417969 2 19.902344 C 2 12.789063 7.832031 7 15 7 C 18.894531 7 22.542969 8.722656 25 11.664063 C 27.457031 8.722656 31.105469 7 35 7 C 42.167969 7 48 12.789063 48 19.902344 C 48 31.417969 37.832031 38.171875 30.40625 43.105469 C 28.5 44.371094 26.855469 45.464844 25.640625 46.472656 Z" />
  </SvgIcon>
)

export const ThumbIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M14 9V5a3 3 0 0 0-3-3L7 12v9h10.4a2 2 0 0 0 2-1.7l1.3-7a2 2 0 0 0-2-2H14z" />
    <path d="M7 12H3v9h4" />
  </SvgIcon>
)

export const CommentIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 11.5a8.5 8.5 0 0 0-8.5-8.5h-1A8.5 8.5 0 0 0 3 11.5c0 4.4 3.6 8 8 8h1l5 4v-4.5c2.1-1.5 4-3.6 4-7.5z" />
  </SvgIcon>
)

export const BookmarkIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </SvgIcon>
)

export const ShareIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </SvgIcon>
)

export const DonateIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 7h-4l-2-3H10L8 7H4l-1 5h18z" />
    <path d="M4 12v7h16v-7" />
    <path d="M12 15c2.5-1.6 3-4.4 1.2-5.1-1.2-.5-2.1.6-1.2 1.6.9-1.1 0-2.2-1.2-1.6C9 10.6 9.5 13.4 12 15z" />
  </SvgIcon>
)

export const SearchIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </SvgIcon>
)

export const PlusCircleIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <line x1="12" y1="8.5" x2="12" y2="15.5" />
    <line x1="8.5" y1="12" x2="15.5" y2="12" />
  </SvgIcon>
)

export const UploadIcon = (props: BaseIconProps) => <PlusCircleIcon {...props} />

export const MessageIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 7h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4l-4 3-4-3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
  </SvgIcon>
)

export const HomeIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </SvgIcon>
)

export const UserIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 19c1.5-3 4.5-4.5 7-4.5s5.5 1.5 7 4.5" />
  </SvgIcon>
)

export const PlusIcon = (props: BaseIconProps) => (
  <SvgIcon stroke="currentColor" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="7" x2="12" y2="17" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </SvgIcon>
)

export const PlayIcon = (props: BaseIconProps) => (
  <SvgIcon viewBox="0 0 24 24" stroke="none" fill="currentColor" {...props}>
    <path d="M5 3.868v16.264A1 1 0 0 0 6.56 21.6L20.42 12 6.56 2.4A1 1 0 0 0 5 3.868z" />
  </SvgIcon>
)

export const PauseIcon = (props: BaseIconProps) => (
  <SvgIcon viewBox="0 0 24 24" stroke="none" fill="currentColor" {...props}>
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </SvgIcon>
)

// Simple image-based icon wrapper for vendor-provided SVG assets in `public/media/icons`
type ImgIconProps = React.ImgHTMLAttributes<HTMLImageElement> & { src?: string }

const ImgIcon = ({ src, alt = '', width, height, ...rest }: ImgIconProps) => (
  <img src={src} alt={alt} width={width} height={height} {...rest} />
)

export const SvgLike = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-like.svg" alt="Like" {...props} />
export const SvgComments = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-comments.svg" alt="Comments" {...props} />
export const SvgCommentsAlt = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-comments-1.svg" alt="Comments" {...props} />
export const SvgBookmark = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-bookmark.svg" alt="Bookmark" {...props} />
export const SvgVolume = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-volume.svg" alt="Volume" {...props} />
export const SvgMute = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-mute.svg" alt="Mute" {...props} />
export const SvgExitSmall = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-exit-1.svg" alt="Close" {...props} />
export const SvgExitCircle = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-exit-2.svg" alt="Close" {...props} />
export const SvgPerson = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-person.svg" alt="Profile" {...props} />
export const SvgInbox = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-inbox.svg" alt="Inbox" {...props} />
export const SvgDiscover = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-discover.svg" alt="Discover" {...props} />
export const SvgBack = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-back-arrow.svg" alt="Back" {...props} />
export const SvgShare = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-share.svg" alt="Share" {...props} />
export const SvgVerified = (props: ImgIconProps) => <ImgIcon src="/media/icons/icons8-verified.svg" alt="Verified" {...props} />

export const MessageSendIcon = (props: BaseIconProps) => (
  <svg width={props.width || 35} height={props.height || 35} viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="35" height="35" rx="17.5" fill="#373F27" />
    <path d="M17.5 1.40002C8.62192 1.40002 1.40002 8.62262 1.40002 17.5C1.40002 26.3774 8.62192 33.6 17.5 33.6C26.3781 33.6 33.6 26.3774 33.6 17.5C33.6 8.62262 26.3781 1.40002 17.5 1.40002ZM24.9949 15.8949C24.8584 16.0314 24.6792 16.1 24.5 16.1C24.3208 16.1 24.1416 16.0314 24.0051 15.8949L18.2 10.0898V26.6C18.2 26.9864 17.8871 27.3 17.5 27.3C17.1129 27.3 16.8 26.9864 16.8 26.6V10.0898L10.9949 15.8949C10.7212 16.1686 10.2788 16.1686 10.0051 15.8949C9.73142 15.6212 9.73142 15.1788 10.0051 14.9051L17.0044 7.90582C17.0688 7.84072 17.1465 7.78962 17.2326 7.75392C17.4034 7.68322 17.5966 7.68322 17.7674 7.75392C17.8535 7.78962 17.9305 7.84072 17.9956 7.90582L24.9949 14.9051C25.2686 15.1788 25.2686 15.6212 24.9949 15.8949Z" fill="#FAD291" />
  </svg>
)
