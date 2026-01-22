import React, { useState, useEffect } from "react";

interface AvatarProps {
  src?: string;
  name: string;
  className?: string;
  placeholderClassName?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  name, 
  className = "w-full h-full object-cover",
  placeholderClassName = "w-full h-full flex items-center justify-center bg-zed-element dark:bg-zinc-800 text-zed-muted dark:text-zinc-400 font-bold"
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state when src changes
    setHasError(false);
  }, [src]);

  const getAuthorInitials = (authorName: string) => {
    return authorName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={name}
        className={className}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={placeholderClassName}>
      <span className="text-xs">{getAuthorInitials(name)}</span>
    </div>
  );
};
