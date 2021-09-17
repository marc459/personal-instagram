export const parseTrackFeatures = function (track: SpotifyApi.AudioFeaturesResponse): {
  key: string;
  mode: string;
  energy: number;
  tonality: string;
  bpm: number;
  time_signature: string,
  battito: number
} {
  const songKeyCodes = new Map([
    [-1, "Unkown key"],
    [0, "C"],
    [1, "C#"],
    [2, "D"],
    [3, "D#"],
    [4, "E"],
    [5, "F"],
    [6, "F#"],
    [7, "G"],
    [8, "G#"],
    [9, "A"],
    [10, "A#"],
    [11, "B"],
  ]);

  const songTonalityCodes = new Map([
    ["A major", "11B"],
    ["A minor", "8A"],
    ["A# major", "6B"],
    ["A# minor", "3A"],
    ["B major", "1B"],
    ["B minor", "10A"],
    ["C major", "8B"],
    ["C minor", "5A"],
    ["C# major", "3B"],
    ["C# minor", "12A"],
    ["D major", "10B"],
    ["D minor", "7A"],
    ["D# major", "5B"],
    ["D# minor", "2A"],
    ["E major", "12B"],
    ["E minor", "9A"],
    ["F major", "7B"],
    ["F minor", "4A"],
    ["F# major", "2B"],
    ["F# minor", "11A"],
    ["G major", "9B"],
    ["G minor", "6A"],
    ["G# major", "4B"],
    ["G# minor", "1A"],
  ]);

  //console.log(song_key_codes)

  const songModes = new Map([
    [-1, "Unkown mode"],
    [0, "minor"],
    [1, "major"],
  ]);

  return {
    key: songKeyCodes.get(track.key)!,
    mode: songModes.get(track.mode)!,
    energy: Math.round(track.energy * 10),
    bpm: track.tempo,
    tonality: songTonalityCodes.get(
      songKeyCodes.get(track.key)! + " " + songModes.get(track.mode)!
    ) as string,
    time_signature: track.time_signature + "/4",
    battito: track.time_signature
  };
};
