import { useState, useCallback, useMemo } from 'react';
import { DRILL_TREE } from '../utils/drillHierarchy';

export function useDrillDown(tree = DRILL_TREE) {
  const [drillPath, setDrillPath] = useState([]);

  const currentNode = drillPath.length
    ? drillPath[drillPath.length - 1].node
    : tree;

  const currentChildren = currentNode.children ?? [];

  // Desce um nível — ignora nós folha (sem filhos)
  const handleDrillDown = useCallback((childNode) => {
    if (!childNode.children?.length) return;
    setDrillPath(prev => [
      ...prev,
      { id: childNode.id, label: childNode.label, node: childNode },
    ]);
  }, []);

  // Navega para qualquer ponto do breadcrumb; index = -1 retorna à raiz
  const handleDrillUp = useCallback((index) => {
    setDrillPath(prev => (index < 0 ? [] : prev.slice(0, index + 1)));
  }, []);

  // Breadcrumb: [{ label, index }]  — index -1 = raiz
  const breadcrumb = useMemo(() => [
    { label: tree.label, index: -1 },
    ...drillPath.map((step, i) => ({ label: step.label, index: i })),
  ], [drillPath, tree.label]);

  // depth = número de níveis abaixo da raiz (0 = exibindo L0)
  const depth = drillPath.length;

  return {
    currentNode,
    currentChildren,
    breadcrumb,
    handleDrillDown,
    handleDrillUp,
    depth,
  };
}
