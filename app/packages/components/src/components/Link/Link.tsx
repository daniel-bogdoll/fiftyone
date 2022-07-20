import { RouterContext } from "@fiftyone/state";
import React, { useCallback, useContext, useTransition } from "react";

const Link: React.FC<
  React.PropsWithChildren<{
    to?: string;
    title: string;
    className?: string;
    style?: React.CSSProperties;
  }>
> = ({ children, className, style, title, to }) => {
  const router = useContext(RouterContext);
  const [pending, startTransition] = useTransition();

  return (
    <a
      href={to}
      onClick={
        to
          ? useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
              (event) => {
                event.preventDefault();
                startTransition(() => {
                  router.history.push(to);
                });
              },
              [to, router]
            )
          : undefined
      }
      style={style}
      className={className}
      title={title}
    >
      {children}
    </a>
  );
};

export default Link;
