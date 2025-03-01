import { Flex, HStack, IconButton, Popover, PopoverContent, PopoverTrigger, Spacer, Spinner, useDisclosure, useToast } from "@chakra-ui/react";
import { useDeep, useDeepQuery } from "@deep-foundation/deeplinks/imports/client";
import { useMinilinksFilter } from "@deep-foundation/deeplinks/imports/minilinks";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { TiArrowBackOutline } from "react-icons/ti";
import { VscChromeClose, VscVersions } from "react-icons/vsc";
import { useLocalStorage } from "usehooks-ts";
import { ClientHandler } from "../client-handler";
import { CytoReactLinksCard } from "../cyto-react-links-card";
import { useContainer, useInsertingCytoStore, useRefAutofill } from "../hooks";
import { LinkClientHandlerDefault } from "../link-client-handlers/default";
import { CatchErrors } from "../react-errors";

export interface IInsertedLink {
  position: { x: number; y: number; };
  from: number; to: number;
};

export interface IInsertedLinkProps {
  insertingLink?: IInsertedLink;
  setInsertingLink?: (insertingLink: IInsertedLink) => void;
  ml?: any;
  ehRef?: any;
  returningRef?: any;
  insertLinkRef?: any;
}

export function CytoReactLinksCardInsertNode({
  insertingLink, setInsertingLink, ml, ehRef, returningRef, insertLinkRef,
}: IInsertedLinkProps) {
  const [search, setSearch] = useState('');
  const deep = useDeep();
  const [insertingCyto, setInsertingCyto] = useInsertingCytoStore();
  const [container, setContainer] = useContainer();

  const types = useMinilinksFilter(
    ml,
    useCallback(() => true, []),
    useCallback((l, ml) => (ml.links.filter(l => l._applies.includes('insertable-types'))), []),
  ) || [];

  const elements = (types || [])?.map(t => ({
    id: t.id,
    src:  t?.inByType[deep.idSync('@deep-foundation/core', 'Symbol')]?.[0]?.value?.value || t.id,
    linkName: t?.inByType[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.value?.value || t.id,
    containerName: t?.inByType[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.from?.value?.value || '',
  }));
  return <CytoReactLinksCard
    elements={elements.filter(el => (!!el?.linkName?.includes && el?.linkName?.toLocaleLowerCase()?.includes(search) || el?.containerName?.includes && el?.containerName?.toLocaleLowerCase()?.includes(search)))}
    search={search}
    onSearch={e => setSearch(e.target.value)}
    onSubmit={async (id) => {
      const insertable = ml.links.filter(l => l._applies.includes('insertable-types'));
      const type = insertable?.find(t => t.id === id);
      const isNode = !type.from_id && !type.to_id;
      setInsertingCyto({});
      if (isNode) {
        await deep.insert({
          type_id: id,
          in: { data: [
            {
              from_id: container,
              type_id: deep.idSync('@deep-foundation/core', 'Contain'),
            },
            {
              from_id: container,
              type_id: deep.idSync('@deep-foundation/core', 'Focus'),
              object: { data: { value: insertingLink.position } },
              in: { data: {
                type_id: deep.idSync('@deep-foundation/core', 'Contain'),
                from_id: container
              } },
            },
          ] },
        });
        setInsertingLink(undefined);
      } else {
        returningRef?.current.startInsertingOfType(id);
      }
    }}
  />;
};

export function useInsertLinkCard(elements, reactElements, focus, refCy, ml, ehRef) {
  const [insertingLink, setInsertingLink] = useState<IInsertedLink>();
  const [container, setContainer] = useContainer();
  const containerRef = useRefAutofill(container);
  const deep = useDeep();
  const deepRef = useRefAutofill(deep);
  const [insertingCyto, setInsertingCyto] = useInsertingCytoStore();
  const insertingCytoRef = useRefAutofill(insertingCyto);
  const toast = useToast();

  useHotkeys('esc', e => {
    e.preventDefault();
    e.stopPropagation();
    if (insertingCyto?.type_id) {
      setInsertingCyto(undefined);
    }
  }, { enableOnTags: ["TEXTAREA", "INPUT"] });

  const types = useMinilinksFilter(
    ml,
    useCallback(() => true, []),
    useCallback((l, ml) => (ml.links.filter(l => l._applies.includes('insertable-types'))), []),
  ) || [];

  const insertLink = useCallback(async (type_id, from, to) => {
    const loadedLink = types?.find(t => t.id === type_id);
    const valued = loadedLink?.valued?.[0]?.to_id;
    const { data: [{ id: linkId }] } = await deep.insert({
      type_id: type_id,
      ...(valued === deep.idSync('@deep-foundation/core', 'String') ? { string: { data: { value: '' } } } :
        valued === deep.idSync('@deep-foundation/core', 'Number') ? { number: { data: { value: 0 } } } :
        valued === deep.idSync('@deep-foundation/core', 'Object') ? { object: { data: { value: {} } } } :
        {}),
      ...(container && type_id !== deep.idSync('@deep-foundation/core', 'Contain') ? {
        in: { data: {
          from_id: container,
          type_id: deep.idSync('@deep-foundation/core', 'Contain'),
        } },
      } : {}),
      from_id: from || 0,
      to_id: to || 0,
    });
    setInsertingLink((insertLink) => {
      if (!from && !to && !!insertLink) focus(linkId, insertLink.position);
      return undefined;
    })
  }, [types, container, deep.linkId]);
  const insertLinkRef = useRefAutofill(insertLink);

  const TempComponent = useMemo(() => {
    return () => <CytoReactLinksCardInsertNode
      insertingLink={insertingLink}
      setInsertingLink={setInsertingLink}
      ml={ml}
      ehRef={ehRef}
      returningRef={returningRef}
      insertLinkRef={insertLinkRef}
    />;
  }, [insertingLink]);
  if (insertingLink) {
    const element = {
      id: 'insert-link-card',
      position: insertingLink.position,
      locked: true,
      classes: 'insert-link-card',
      data: {
        id: 'insert-link-card',
        Component: TempComponent,
      },
    };
    elements.push(element);
    reactElements.push(element);
  }

  const returning = {
    insertLink,
    openInsertCard: (insertedLink: IInsertedLink) => {
      if (insertedLink) {
        const cy = refCy.current._cy;
        setInsertingLink(insertedLink);
        const el = cy.$('#insert-link-card');
        el.unlock();
        if (!insertedLink.from && !insertedLink.to) {
          el.position(insertedLink.position);
          el.lock();
        }
      } else {
        setInsertingLink(undefined);
      }
    },
    insertingCyto,
    startInsertingOfType: (id: number) => {
      const link = ml.byId[id];
      const isNode = !link.from_id && !link.to_id;
      const TypeName = link?.inByType?.[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.value?.value || link?.id;
      const FromName = ml.byId[link.from_id]?.inByType?.[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.value?.value || link.from_id;
      const ToName = ml.byId[link.to_id]?.inByType?.[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.value?.value || link.to_id;
      const t = toast({
        title: `Inserting link type of: ${TypeName}`,
        description: `This ${isNode ? `is node type, just click somewhere for insert.` : `is link type, connect two links from typeof ${FromName} to typeof ${ToName} for insert.`}`,
        position: 'bottom-left',
        duration: null,
        icon: <Spinner />,
        isClosable: true,
        onCloseComplete: () => {
          if (insertingCytoRef?.current?.type_id) setInsertingCyto({});
          ehRef?.current?.disableDrawMode();
          const cy = refCy.current._cy;
          cy.$('.eh-ghost,.eh-preview').remove();
        },
      });
      if (!isNode) {
        ehRef?.current?.enableDrawMode();
      }
      setInsertingLink(undefined);
      setInsertingCyto({ isNode, type_id: id, toast: t });
    },
    drawendInserting: (position, from, to) => {
      const ins = insertingCytoRef.current;
      setInsertingCyto({});
      toast.close(ins.toast);
      ehRef?.current?.disableDrawMode();
      const cy = refCy.current._cy;
      cy.$('.eh-ghost,.eh-preview').remove();
      if (ins.type_id) {
        insertLinkRef.current(ins.type_id, +from, +to);
      } else {
        returning.openInsertCard({
          position, from, to
        });
      }
    },
  };
  const returningRef = useRefAutofill(returning);

  useEffect(() => {
    const cy = refCy.current._cy;
    const ehstop = async (event, sourceNode, targetNode, addedEdge) => {
      let { position } = event;
      addedEdge?.remove();
      ehRef?.current?.disableDrawMode();
      const ins = insertingCytoRef.current;
      setInsertingCyto({});
      toast.close(ins.toast);
    };
    const ehcomplete = async (event, sourceNode, targetNode, addedEdge) => {
      let { position } = event;
      addedEdge?.remove();
      const from = sourceNode?.data('link')?.id;
      const to = targetNode?.data('link')?.id;
      if (from && to) returning.drawendInserting(position, from, to);
    };
    const tap = async function(event){
      ehRef?.current?.disableDrawMode();
      const ins = insertingCytoRef.current;
      setInsertingCyto({});
      toast.close(ins.toast);
      const ncy = refCy.current._cy;
      if(event.target === ncy){
        if (insertingCytoRef.current.type_id) {
          if (insertingCytoRef.current.isNode) {
            await deepRef.current.insert({
              type_id: insertingCytoRef.current.type_id,
              in: { data: [
                {
                  from_id: containerRef.current,
                  type_id: deep.idSync('@deep-foundation/core', 'Contain'),
                },
                {
                  from_id: containerRef.current,
                  type_id: deep.idSync('@deep-foundation/core', 'Focus'),
                  object: { data: { value: event.position } },
                  in: { data: {
                    type_id: deep.idSync('@deep-foundation/core', 'Contain'),
                    from_id: containerRef.current
                  } },
                },
              ] },
            });
            toast.close(insertingCytoRef.current.toast);
            setInsertingCyto({});
          } else {
            setInsertingCyto({});
          }
        }
        returningRef.current?.openInsertCard(undefined);
      }
    };
    cy.on('ehstop', ehstop);
    cy.on('ehcomplete', ehcomplete);
    cy.on('tap', tap);
    return () => {
      cy.removeListener('ehstop', ehstop);
      cy.removeListener('ehcomplete', ehcomplete);
      cy.removeListener('tap', tap);
    };
  }, []);

  return returning;
}

export function useLinkReactElements(elements, reactElements, refCy, ml) {
  const [linkReactElements, setLinkReactElements] = useState<{ [key: string]: boolean }>({});
  const linkReactElementsIds = useMemo(() => Object.keys(linkReactElements).filter(key => !!linkReactElements[key]), [linkReactElements]).map(key => parseInt(key), [linkReactElements]);

  reactElements.push(...linkReactElementsIds.map(id => (elements.find(e => e.id === id))));

  const toggleLinkReactElement = useMemo(() => (id: number) => {
    console.log('useLinkReactElements', 'toggleLinkReactElement', id);
    setLinkReactElements((linkReactElements) => {
      const cy = refCy.current._cy;
      const isEnabling = !linkReactElements[id];
      if (isEnabling) {
        cy.$(`#${id}`).data('Component', AnyLinkComponent);
        cy.$(`#${id}`).addClass('unhoverable').removeClass('hover');
        cy.$(`#${id}`).style({
          'shape': 'rectangle',
          'background-opacity': '0',
        });
      } else {
        cy.$(`#${id}`).data('Component', undefined);
        cy.$(`#${id}`).removeClass('unhoverable');
        cy.$(`#${id}`).style({
          'shape': null,
          width: null,
          height: null,
          'background-opacity': null,
          'border-width': 0,
        });
      }
      return {
        ...linkReactElements,
        [id]: !linkReactElements[id],
      };
    });
  }, []);

  const AnyLinkComponent = useMemo(() => {
    return function AnyLinkComponent({ id }: { id: number }) {
      const deep = useDeep();
      const [handlerId, setHandlerId] = useState();
      const { onOpen, onClose, isOpen } = useDisclosure();
      const [search, setSearch] = useState('');

      let handlers = useMinilinksFilter(
        ml,
        useCallback((l) => true, []),
        useCallback((l, ml) => {
          return ml.byType[deep.idSync('@deep-foundation/core', 'Handler')]?.filter(l => (
            !!l?.inByType?.[deep.idSync('@deep-foundation/core', 'HandleClient')]?.filter(l => (
              l?.from_id === id || l?.from_id === ml.byId[id]?.type_id
            ))?.length
          ));
        }, [id]),
      ) || [];

      useEffect(() => {
        if (!handlerId) {
          const handler = handlers?.[0];
          if (handler) {
            setHandlerId(handler.id);
          }
        }
      }, [handlers]);

      const handler = handlers?.find(h => h.id === handlerId);
      const elements = handlers.map(t => ({
        id: t?.id,
        src:  t?.inByType[deep.idSync('@deep-foundation/core', 'Symbol')]?.[0]?.value?.value || t.id,
        linkName: t?.inByType[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.value?.value || t.id,
        containerName: t?.inByType[deep.idSync('@deep-foundation/core', 'Contain')]?.[0]?.from?.value?.value || '',
      }));
      console.log({ elements });

      return <div>
        <CatchErrors errorRenderer={(error, reset) => {
          return <div>{String(error)}</div>;
        }}>
          <Flex>
            <Popover
              isLazy
              isOpen={isOpen}
              onOpen={onOpen}
              onClose={onClose}
              placement='right-start'
            >
              <PopoverTrigger>
                <IconButton 
                  aria-label='replay to message button'
                  isRound
                  size={'xs'}
                  sx={{
                    _hover: {
                      transform: 'scale(1.2)',
                    }
                  }}
                  icon={<VscVersions />}
                  // onClick={() => console.log('replay')}
                />
              </PopoverTrigger>
              <PopoverContent h={72}>
                <CytoReactLinksCard
                  selectedLinkId={handlerId}
                  elements={elements.filter(el => (!!el?.linkName?.includes && el?.linkName?.toLocaleLowerCase()?.includes(search) || el?.containerName?.includes && el?.containerName?.toLocaleLowerCase()?.includes(search)))}
                  search={search}
                  onSearch={e => setSearch(e.target.value)}
                  onSubmit={async (id) => {
                    setHandlerId(id);
                    onClose();
                  }}
                  fillSize
                />
              </PopoverContent>
            </Popover>
            <Spacer />
            <IconButton
              isRound
              aria-label='close client handler'
              size={'xs'}
              sx={{
                _hover: {
                  transform: 'scale(1.2)',
                }
              }}
              icon={<VscChromeClose />}
              onClick={() => toggleLinkReactElement(id)}
            />
          </Flex>
          {!handler?.id && <div>234</div>}
          {!!handler?.id && <ClientHandler handlerId={handler?.id} linkId={id} ml={ml}/>}
        </CatchErrors>
      </div>;
    };
  }, []);

  return {
    toggleLinkReactElement,
    linkReactElements: linkReactElementsIds,
  };
}

export function useCytoEditor() {
  return useLocalStorage('cyto-editor', false);
}