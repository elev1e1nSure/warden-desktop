import * as React from "react";

export function renderAnimatedIcon(icon: React.ReactNode, isHovered: boolean) {
  if (!React.isValidElement(icon)) return icon;
  return React.cloneElement(icon as React.ReactElement<{ isHovered?: boolean }>, { isHovered });
}
