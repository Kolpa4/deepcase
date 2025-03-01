import { useQuery, useSubscription } from "@apollo/client";
import { useDeep } from "@deep-foundation/deeplinks/imports/client";
import { generateQuery, generateQueryData } from "@deep-foundation/deeplinks/imports/gql";
import { Link, useMinilinksFilter } from "@deep-foundation/deeplinks/imports/minilinks";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDelayedInterval } from "./use-delayed-interval";

export function DeepLoaderActive({
  name,
  query: queryLink,
  onChange,
  debounce = 1000,
}: {
  name: string;
  query: any;
  onChange: (results: Link<number>[]) => any;
  debounce?: number;
}) {
  const deep = useDeep();
  const subQuery = useMemo(() => {
    const v = (queryLink?.value?.value);
    const variables = deep.serializeQuery(v);
    return generateQuery({
      operation: 'query',
      queries: [generateQueryData({
        tableName: 'links',
        returning: `
          id type_id from_id to_id value
        `,
        variables: v
        ? { ...variables, where: variables?.where }
        : { where: {}, limit: 0 },
      })],
      name: name,
    });
  }, [queryLink, queryLink?.value?.value]);
  const subQueryResults = useQuery(subQuery.query, { variables: subQuery.variables });
  const [sintSubQueryResults, setSintSubQueryResults] = useState<any>(subQueryResults);
  const subQueryPrimary = sintSubQueryResults || subQueryResults;

  const delayedSubQueryRef = useRef<any>();
  delayedSubQueryRef.current = subQuery;
  useDelayedInterval(useCallback(() => new Promise((res) => {
    subQueryResults.refetch(delayedSubQueryRef.current.variables).then((r) => {
      setSintSubQueryResults(r);
      res(undefined);
    });
  }), [queryLink, queryLink?.value?.value]), debounce);

  useEffect(() => {
    if (subQueryPrimary?.data?.q0) onChange && onChange(subQueryPrimary?.data?.q0);
  }, [subQueryPrimary]);

  useEffect(() => {
    return () => {
      onChange && onChange([]);
    }
  }, []);

  return <></>;
}

export const DeepLoader = memo(function DeepLoader({
  spaceId,
  minilinks,
}: {
  spaceId?: number;
  minilinks?: any;
}) {
  const deep = useDeep();
  const userId = deep.linkId;

  const spaceQuery = useMemo(() => ({ value: { value: {
    up: {
      tree_id: { _eq: deep.idSync('@deep-foundation/core', 'containTree') },
      parent_id: { _eq: spaceId },
    },
    type_id: {
      _nin: [
        deep.idSync('@deep-foundation/core', 'Then'),
        deep.idSync('@deep-foundation/core', 'Promise'),
        deep.idSync('@deep-foundation/core', 'Resolved'),
        deep.idSync('@deep-foundation/core', 'Rejected'),
        deep.idSync('@deep-foundation/core', 'PromiseResult'),
      ],
    },
  } } }), []);

  let queries = useMinilinksFilter(
    minilinks.ml,
    useCallback((l) => {
      return [deep.idSync('@deep-foundation/core', 'Query'), deep.idSync('@deep-foundation/core', 'Active')].includes(l.type_id);
    }, [spaceId]),
    useCallback((l, ml) => {
      return ml.byType[deep.idSync('@deep-foundation/core', 'Query')]?.filter((l) => {
        return l?.type_id === deep.idSync('@deep-foundation/core', 'Query') && !!l?.inByType?.[deep.idSync('@deep-foundation/core', 'Active')]?.find(a => a?.from_id === spaceId) && l?.value?.value;
      });
    }, [spaceId]),
  );
  console.log('queries', queries);
  queries = queries || [];

  const insertableTypesQuery = useMemo(() => ({ value: { value: {
    _or: [
      {
        can_object: {
          action_id: { _eq: 121 },
          subject_id: { _eq: userId }
        }
      }, {
        type_id: { _in: [
          deep.idSync('@deep-foundation/core', 'Type'),
          deep.idSync('@deep-foundation/core', 'HandleOperation'),
          deep.idSync('@deep-foundation/core', 'Operation'),
          deep.idSync('@deep-foundation/core', 'TreeInclude'),
        ] }
      },
    ],
  } } }), [userId]);

  const insertableTypes = useMinilinksFilter(
    minilinks.ml,
    useCallback((l) => !!l?._applies?.includes('insertable-types'), []),
    useCallback((l, ml) => (ml.links.filter(l => l._applies.includes('insertable-types')).map(l => l.id)), []),
  ) || [];

  const typeIds = useMinilinksFilter(
    minilinks.ml,
    useCallback((l) => true, []),
    useCallback((l, ml) => {
      return Object.keys(ml.byType).map(type => parseInt(type));
    }, []),
  ) || [];

  const queryAndSpaceLoadedIds = useMinilinksFilter(
    minilinks.ml,
    useCallback((l) => !!l?._applies?.find(a => a.includes('query-') || a.includes('space')), []),
    useCallback((l, ml) => (ml.links.filter(l => l._applies?.find(a => a.includes('query-') || a.includes('space'))).map(l => l.id)), []),
  ) || [];

  const containsAndSymbolsQuery = useMemo(() => {
    const ids = [...typeIds, ...insertableTypes, ...queryAndSpaceLoadedIds];
    return { value: { value: {
      to_id: { _in: ids },
      type_id: { _in: [deep.idSync('@deep-foundation/core', 'Contain'), deep.idSync('@deep-foundation/core', 'Symbol')] },
    } } };
  }, [typeIds, insertableTypes, queryAndSpaceLoadedIds]);

  const valuesQuery = useMemo(() => {
    const ids = [...typeIds, ...insertableTypes, ...queryAndSpaceLoadedIds];
    return { value: { value: {
      from_id: { _in: ids },
      type_id: { _eq: deep.idSync('@deep-foundation/core', 'Value') },
    } } };
  }, [typeIds, insertableTypes, queryAndSpaceLoadedIds]);

  const typesQuery = useMemo(() => {
    return { value: { value: {
      id: { _in: typeIds },
    } } };
  }, [typeIds]);

  const clientHandlersQuery = useMemo(() => {
    const ids = [...typeIds, ...queryAndSpaceLoadedIds];
    return { value: { value: {
      in: {
        type_id: deep.idSync('@deep-foundation/core', 'Handler'),
        from_id: deep.idSync('@deep-foundation/core', 'clientSupportsJs'),
        in: {
          type_id: deep.idSync('@deep-foundation/core', 'HandleClient'),
          from_id: {
            _in: ids,
          },
        },
      }
    } } };
  }, [typeIds, queryAndSpaceLoadedIds]);

  return <>
    <DeepLoaderActive
      name="DEEPCASE_SPACE"
      query={spaceQuery}
      onChange={(r) => {
        minilinks.ml.apply(r, 'space');
      }}
    />
    <DeepLoaderActive
      name="DEEPCASE_CLIENT_HANDLERS"
      query={clientHandlersQuery}
      onChange={(r) => {
        minilinks.ml.apply(r, 'client-handlers');
      }}
    />
    {queries?.map((f, i) => (<DeepLoaderActive
      name={`DEEPCASE_QUERY_${f.id}`}
      key={f.id}
      query={f}
      onChange={(r) => {
        minilinks.ml.apply(r, `query-${f.id}`);
      }}
    />))}
    <DeepLoaderActive
      name={`DEEPCASE_INSERTABLE_TYPES`}
      query={insertableTypesQuery}
      onChange={(r) => {
        minilinks.ml.apply(r, 'insertable-types');
      }}
    />
    <DeepLoaderActive
      name={`DEEPCASE_TYPES`}
      query={typesQuery}
      onChange={(r) => {
        minilinks.ml.apply(r, 'types');
      }}
    />
    {!!typeIds && <DeepLoaderActive
      name={`DEEPCASE_CONTAINS_AND_SYMBOLS`}
      query={containsAndSymbolsQuery}
      debounce={2000}
      onChange={(r) => {
        minilinks.ml.apply(r, 'contains_and_symbols');
      }}
    />}
    {!!typeIds && <DeepLoaderActive
      name={`DEEPCASE_VALUES`}
      query={valuesQuery}
      onChange={(r) => {
        minilinks.ml.apply(r, 'values');
      }}
    />}
  </>;
});