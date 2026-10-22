use crate::PayloadError;

/// Heap accounting and validation for payload fields, independent of tree shape.
/// The `markdown_definitions::payload` and `node` attributes derive this trait
/// from the fields themselves so new fields cannot escape accounting.
pub trait PayloadFields {
    fn heap_bytes(&self) -> usize;
    fn validate_fields(&self) -> Result<(), PayloadError> {
        Ok(())
    }
}

macro_rules! scalars {
    ($($ty:ty),+ $(,)?) => { $(impl PayloadFields for $ty {
        fn heap_bytes(&self) -> usize { 0 }
    })+ };
}
scalars!(
    (),
    bool,
    char,
    u8,
    u16,
    u32,
    u64,
    u128,
    usize,
    i8,
    i16,
    i32,
    i64,
    i128,
    isize,
    f32,
    f64
);

impl PayloadFields for String {
    fn heap_bytes(&self) -> usize {
        self.len()
    }
}
impl<T: PayloadFields> PayloadFields for Option<T> {
    fn heap_bytes(&self) -> usize {
        self.as_ref().map_or(0, PayloadFields::heap_bytes)
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        if let Some(value) = self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields> PayloadFields for Vec<T> {
    fn heap_bytes(&self) -> usize {
        self.iter().fold(
            self.len().saturating_mul(std::mem::size_of::<T>()),
            |total, field| total.saturating_add(field.heap_bytes()),
        )
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        for value in self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields, const N: usize> PayloadFields for [T; N] {
    fn heap_bytes(&self) -> usize {
        self.iter().fold(0usize, |total, field| {
            total.saturating_add(field.heap_bytes())
        })
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        for value in self {
            value.validate_fields()?;
        }
        Ok(())
    }
}
impl<T: PayloadFields> PayloadFields for Box<T> {
    fn heap_bytes(&self) -> usize {
        std::mem::size_of::<T>().saturating_add((**self).heap_bytes())
    }
    fn validate_fields(&self) -> Result<(), PayloadError> {
        (**self).validate_fields()
    }
}
