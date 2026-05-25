import React from "react";

export const MyceliaIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  return (
    <img
      src="mycelia.svg"
      className={className}
      style={{ ...style, display: "block" }}
      alt="Mycelia"
    />
  );
};
