import { useState, useRef } from 'react';
import { isEditableEvent } from '../helpers.js';
import { validateSocialSecurityClaimAge } from '../../../fireCalculations.js';
import { setLastChartChangeType } from '../changeTypeTracker.js';
import { clampDragAge } from './eventEditingUtils.js';

export function useTimelineDragController({
  inputs,
  timelineEvents,
  commitEventAgeChange,
  setNotification
}) {
  const [draggingInfo, setDraggingInfo] = useState(null);
  const dragOccurredRef = useRef(false);

  const handleNodeDragStart = (e, evt) => {
    if (!isEditableEvent(evt) || evt.type === 'fiReached' || evt.type === 'mortgageOff') return;

    e.preventDefault();
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;

    const track = e.currentTarget.closest('.timeline-track-inner') || e.currentTarget.closest('.mobile-roadmap-scroll-container');
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
    const minAge = inputs.currentAge;
    const maxAge = inputs.lifeExpectancy;
    const totalYears = maxAge - minAge;
    const initialAge = typeof evt.age === 'number' && !isNaN(evt.age) ? evt.age : (inputs.currentAge || 35);

    let childEndOffset = 0;
    if (evt.type === 'haveChild') {
      const linkedEndEvent = timelineEvents.find(e => e.type === 'childSupportEnds' && String(e.childEventId) === String(evt.originalId));
      if (linkedEndEvent) {
        childEndOffset = linkedEndEvent.age - evt.age;
      } else {
        const lifeEv = inputs.lifeEvents?.find(e => e.id === evt.originalId);
        childEndOffset = lifeEv?.includeCollege ? 22 : 18;
      }
    }

    dragOccurredRef.current = false;

    setLastChartChangeType('event_drag');
    setDraggingInfo({
      originalId: evt.originalId || null,
      type: evt.type,
      initialAge,
      currentAge: initialAge,
      startX,
      childEndOffset
    });

    const handleDragMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - startX;

      const deltaYears = trackWidth > 0 ? (deltaX / trackWidth) * totalYears : 0;
      const rawAge = Math.round(initialAge + deltaYears);
      
      const newAge = clampDragAge(rawAge, evt.type, evt.houseId, {
        minAge,
        maxAge,
        childEndOffset,
        lifeEvents: inputs.lifeEvents || []
      });

      if (Math.abs(deltaX) > 2) {
        dragOccurredRef.current = true;
      }

      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      setDraggingInfo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentAge: newAge,
          rawAge: rawAge
        };
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);

      setDraggingInfo(currentDrag => {
        if (currentDrag && dragOccurredRef.current) {
          let targetAge = currentDrag.currentAge;
          if (evt.type === 'socialSecurity') {
            const rawAge = currentDrag.rawAge !== undefined ? currentDrag.rawAge : targetAge;
            const valSS = validateSocialSecurityClaimAge(rawAge);
            targetAge = valSS.validAge;
            if (valSS.wasClamped) {
              setNotification(valSS.message);
              setTimeout(() => setNotification(null), 2000);
            }
          }
          setLastChartChangeType('event_timing_change');
          commitEventAgeChange(evt, targetAge);
        }
        return null;
      });

      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  return {
    draggingInfo,
    setDraggingInfo,
    dragOccurredRef,
    handleNodeDragStart
  };
}
