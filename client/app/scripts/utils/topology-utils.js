import _ from 'lodash';
import { is as isDeepEqual, Map as makeMap, Set as makeSet } from 'immutable';

/**
 * Returns a cache ID based on the topologyId and optionsQuery
 * @param  {String} topologyId
 * @param  {object} topologyOptions (optional)
 * @return {String}
 */
export function buildTopologyCacheId(topologyId, topologyOptions) {
  let id = '';
  if (topologyId) {
    id = topologyId;
    if (topologyOptions) {
      id += JSON.stringify(topologyOptions);
    }
  }
  return id;
}

/**
 * Returns a topology object from the topology tree
 * @param  {List} subTree
 * @param  {String} topologyId
 * @return {Map} topology if found
 */
export function findTopologyById(subTree, topologyId) {
  let foundTopology;

  subTree.forEach(topology => {
    if (_.endsWith(topology.get('url'), topologyId)) {
      foundTopology = topology;
    }
    if (!foundTopology && topology.has('sub_topologies')) {
      foundTopology = findTopologyById(topology.get('sub_topologies'), topologyId);
    }
  });

  return foundTopology;
}

export function updateNodeDegrees(nodes, edges) {
  return nodes.map(node => {
    const nodeId = node.get('id');
    const degree = edges.count(edge => edge.get('source') === nodeId
      || edge.get('target') === nodeId);
    return node.set('degree', degree);
  });
}

/* set topology.id and parentId for sub-topologies in place */
export function updateTopologyIds(topologies, parentId) {
  return topologies.map(topology => {
    const result = Object.assign({}, topology);
    result.id = topology.url.split('/').pop();
    if (parentId) {
      result.parentId = parentId;
    }
    if (topology.sub_topologies) {
      result.sub_topologies = updateTopologyIds(topology.sub_topologies, result.id);
    }
    return result;
  });
}

// adds ID field to topology (based on last part of URL path) and save urls in
// map for easy lookup
export function setTopologyUrlsById(topologyUrlsById, topologies) {
  let urlMap = topologyUrlsById;
  if (topologies) {
    topologies.forEach(topology => {
      urlMap = urlMap.set(topology.id, topology.url);
      if (topology.sub_topologies) {
        topology.sub_topologies.forEach(subTopology => {
          urlMap = urlMap.set(subTopology.id, subTopology.url);
        });
      }
    });
  }
  return urlMap;
}

export function filterHiddenTopologies(topologies) {
  return topologies.filter(t => (!t.hide_if_empty || t.stats.node_count > 0 ||
                               t.stats.filtered_nodes > 0));
}

export function getActiveTopologyOptions(state) {
  // options for current topology, sub-topologies share options with parent
  const parentId = state.getIn(['currentTopology', 'parentId']);
  if (parentId) {
    return state.getIn(['topologyOptions', parentId]);
  }
  return state.getIn(['topologyOptions', state.get('currentTopologyId')]);
}

export function getCurrentTopologyOptions(state) {
  return state.getIn(['currentTopology', 'options']);
}

export function isTopologyEmpty(state) {
  return state.getIn(['currentTopology', 'stats', 'node_count'], 0) === 0
    && state.get('nodes').size === 0;
}

export function getAdjacentNodes(state, originNodeId) {
  let adjacentNodes = makeSet();
  const nodeId = originNodeId || state.get('selectedNodeId');

  if (nodeId) {
    if (state.hasIn(['nodes', nodeId])) {
      adjacentNodes = makeSet(state.getIn(['nodes', nodeId, 'adjacency']));
      // fill up set with reverse edges
      state.get('nodes').forEach((node, id) => {
        if (node.get('adjacency') && node.get('adjacency').includes(nodeId)) {
          adjacentNodes = adjacentNodes.add(id);
        }
      });
    }
  }

  return adjacentNodes;
}

export function hasSelectedNode(state) {
  const selectedNodeId = state.get('selectedNodeId');
  return state.hasIn(['nodes', selectedNodeId]);
}

export function getCurrentTopologyUrl(state) {
  return state.getIn(['currentTopology', 'url']);
}

export function isSameTopology(nodes, nextNodes) {
  const mapper = node => makeMap({id: node.get('id'), adjacency: node.get('adjacency')});
  const topology = nodes.map(mapper);
  const nextTopology = nextNodes.map(mapper);
  return isDeepEqual(topology, nextTopology);
}

export function isNodeMatchingQuery(node, query) {
  return node.get('label').includes(query) || node.get('subLabel').includes(query);
}
