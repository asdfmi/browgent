import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import PixiProjection from "../../../workflow-graph/projection/pixi-projection.js";

export default function GraphViewport({ graphCore }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!graphCore || !containerRef.current) return undefined;
    const projection = new PixiProjection({
      graphCore,
      container: containerRef.current,
    });
    return () => {
      projection.destroy();
    };
  }, [graphCore]);

  return (
    <Box ref={containerRef} />
  );
}

GraphViewport.propTypes = {
  graphCore: PropTypes.object,
};

GraphViewport.defaultProps = {
  graphCore: null,
};
