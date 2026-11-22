package app.movenotes.android.dev;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaPolicyTest {
 @Test public void validAndMissingLocations(){assertTrue(MoveNotesMediaPlugin.validGps(50.85,4.35));assertTrue(MoveNotesMediaPlugin.validGps(0,4));assertFalse(MoveNotesMediaPlugin.validGps(0,0));assertFalse(MoveNotesMediaPlugin.validGps(91,4));assertFalse(MoveNotesMediaPlugin.validGps(50,Double.NaN));}
 @Test public void supportedPhotosOnly(){assertEquals("jpg",MoveNotesMediaPlugin.extension("image/jpeg"));assertEquals("heic",MoveNotesMediaPlugin.extension("image/heic"));assertNull(MoveNotesMediaPlugin.extension("image/svg+xml"));assertNull(MoveNotesMediaPlugin.extension(null));}
}
